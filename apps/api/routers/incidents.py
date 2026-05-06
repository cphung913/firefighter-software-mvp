import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, get_current_user, require_admin
from models.department import Department
from models.incident import Incident
from models.scheduling import ShiftAssignment, ShiftGroup
from models.training import Certification
from models.user import User
from schemas.assets import ApparatusOut
from schemas.incident import (
    BulkNerisExportRequest,
    BulkNerisExportResponse,
    IncidentBootstrapResponse,
    IncidentCreateRequest,
    IncidentOut,
    IncidentReviewRequest,
    IncidentRosterUserOut,
    IncidentSubmitRequest,
    IncidentTaxonomyResponse,
    IncidentUpdateRequest,
    TaxonomyOption,
)
from schemas.scheduling import ShiftAssignmentOut, ShiftGroupOut
from services.assets_service import get_apparatus_list
from services.incident_service import (
    ACTION_TAKEN_CODES,
    NERIS_INCIDENT_TYPES,
    PROPERTY_USE_CODES,
    list_incidents,
    next_incident_number,
    to_neris_json,
)

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("/taxonomy", response_model=IncidentTaxonomyResponse)
async def get_taxonomy(
    _user: User = Depends(get_current_user),
) -> IncidentTaxonomyResponse:
    """Static NERIS taxonomy options — cached by clients for offline dropdowns."""
    return IncidentTaxonomyResponse(
        incident_types=[TaxonomyOption(**o) for o in NERIS_INCIDENT_TYPES],
        action_taken_codes=[TaxonomyOption(**o) for o in ACTION_TAKEN_CODES],
        property_use_codes=[TaxonomyOption(**o) for o in PROPERTY_USE_CODES],
    )


@router.get("/bootstrap", response_model=IncidentBootstrapResponse)
async def bootstrap_incident_form(
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> IncidentBootstrapResponse:
    apparatus = await get_apparatus_list(db, department_id=department.id)
    roster = await db.scalars(
        select(User)
        .where(User.department_id == department.id)
        .order_by(User.name)
    )

    groups_result = await db.execute(
        select(ShiftGroup).where(ShiftGroup.department_id == department.id)
    )
    shift_groups = [
        ShiftGroupOut.model_validate(g, from_attributes=True)
        for g in groups_result.scalars().all()
    ]

    today = date.today()
    all_assignments_result = await db.execute(
        select(ShiftAssignment).where(
            ShiftAssignment.department_id == department.id,
            ShiftAssignment.start_date <= today,
            or_(
                ShiftAssignment.end_date.is_(None),
                ShiftAssignment.end_date >= today,
            ),
        )
    )
    all_active = all_assignments_result.scalars().all()
    shift_assignments = [
        ShiftAssignmentOut.model_validate(a, from_attributes=True)
        for a in all_active
    ]
    my_assignment = next(
        (a for a in shift_assignments if str(a.user_id) == str(user.id)),
        None,
    )

    cutoff_90 = today + timedelta(days=90)
    expiring_certs_count = await db.scalar(
        select(func.count()).where(
            Certification.user_id == user.id,
            Certification.department_id == department.id,
            Certification.expiry_date >= today,
            Certification.expiry_date <= cutoff_90,
        )
    ) or 0

    return IncidentBootstrapResponse(
        apparatus=[
            ApparatusOut.model_validate(unit, from_attributes=True)
            for unit in apparatus
        ],
        users=[
            IncidentRosterUserOut(
                id=str(member.id),
                name=member.name,
                role=member.role,
                badge_number=member.badge_number,
            )
            for member in roster.all()
        ],
        shift_groups=shift_groups,
        shift_assignments=shift_assignments,
        my_assignment=my_assignment,
        expiring_certs_count=expiring_certs_count,
    )


@router.get("", response_model=list[IncidentOut])
async def list_incidents_endpoint(
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[IncidentOut]:
    rows = await list_incidents(db, department_id=department.id, limit=limit, offset=offset)
    return [IncidentOut.model_validate(row, from_attributes=True) for row in rows]


@router.post("", response_model=IncidentOut, status_code=201)
async def create_incident(
    payload: IncidentCreateRequest,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    incident_number = await next_incident_number(
        db, department_id=department.id, alarm_time=payload.alarm_time
    )

    data = payload.model_dump(exclude_none=True)
    data.pop("local_id", None)

    incident = Incident(
        department_id=department.id,
        local_id=payload.local_id,
        incident_number=incident_number,
        created_by=user.id,
        units_responding=data.get("units_responding", []),
        personnel_on_scene=data.get("personnel_on_scene", []),
        casualty_civilian=data.get("casualty_civilian", 0),
        casualty_ff=data.get("casualty_ff", 0),
        actions_taken=data.get("actions_taken", []),
        raw_data=data.get("raw_data", {}),
        **{
            k: v
            for k, v in data.items()
            if k not in {
                "units_responding", "personnel_on_scene",
                "casualty_civilian", "casualty_ff",
                "actions_taken", "raw_data",
            }
        },
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return IncidentOut.model_validate(incident, from_attributes=True)


@router.post("/export/neris", response_model=BulkNerisExportResponse)
async def bulk_export_neris(
    payload: BulkNerisExportRequest,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> BulkNerisExportResponse:
    """Export multiple incidents as NERIS JSON and mark them as exported."""
    if not payload.incident_ids:
        raise HTTPException(status_code=400, detail="No incident IDs provided")

    requested = set(payload.incident_ids)
    result = await db.scalars(
        select(Incident).where(
            Incident.department_id == department.id,
            Incident.id.in_(payload.incident_ids),
        )
    )
    incidents_all = list(result.all())
    if len(incidents_all) != len(requested):
        raise HTTPException(status_code=404, detail="One or more incidents not found")

    approved_result = await db.scalars(
        select(Incident).where(
            Incident.department_id == department.id,
            Incident.id.in_(payload.incident_ids),
            Incident.report_status == "approved",
        )
    )
    approved_incidents = list(approved_result.all())
    skipped_count = len(incidents_all) - len(approved_incidents)

    exported_at = datetime.now(timezone.utc)
    neris_objects: list[dict] = []
    for inc in approved_incidents:
        neris_objects.append(to_neris_json(inc, department))
        inc.neris_exported_at = exported_at

    await db.commit()
    return BulkNerisExportResponse(
        exported_count=len(approved_incidents),
        skipped_count=skipped_count,
        incidents=neris_objects,
        exported_at=exported_at.isoformat(),
    )


@router.post("/{incident_id}/mark-exported", response_model=IncidentOut)
async def mark_exported(
    incident_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    incident = await db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.department_id == department.id,
        )
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident.neris_exported_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(incident)
    return IncidentOut.model_validate(incident, from_attributes=True)


@router.get("/review-queue", response_model=list[IncidentOut])
async def get_review_queue(
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[IncidentOut]:
    rows = (
        await db.scalars(
            select(Incident)
            .where(
                Incident.department_id == department.id,
                Incident.report_status == "submitted",
            )
            .order_by(Incident.updated_at.desc())
        )
    ).all()
    return [IncidentOut.model_validate(row, from_attributes=True) for row in rows]


@router.post("/{incident_id}/submit", response_model=IncidentOut)
async def submit_incident_for_review(
    incident_id: uuid.UUID,
    _payload: IncidentSubmitRequest,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    incident = await db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.department_id == department.id,
        )
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    if incident.report_status not in ("draft", "rejected"):
        raise HTTPException(
            status_code=409,
            detail="Incident already submitted or approved",
        )
    incident.report_status = "submitted"
    await db.commit()
    await db.refresh(incident)
    return IncidentOut.model_validate(incident, from_attributes=True)


@router.post("/{incident_id}/approve", response_model=IncidentOut)
async def approve_incident_review(
    incident_id: uuid.UUID,
    payload: IncidentReviewRequest,
    admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    incident = await db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.department_id == department.id,
        )
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    now = datetime.now(timezone.utc)
    incident.report_status = "approved"
    incident.reviewed_by = admin.id
    incident.reviewed_at = now
    incident.review_notes = payload.notes
    await db.commit()
    await db.refresh(incident)
    return IncidentOut.model_validate(incident, from_attributes=True)


@router.post("/{incident_id}/reject", response_model=IncidentOut)
async def reject_incident_review(
    incident_id: uuid.UUID,
    payload: IncidentReviewRequest,
    admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    incident = await db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.department_id == department.id,
        )
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    now = datetime.now(timezone.utc)
    incident.report_status = "rejected"
    incident.reviewed_by = admin.id
    incident.reviewed_at = now
    incident.review_notes = payload.notes
    await db.commit()
    await db.refresh(incident)
    return IncidentOut.model_validate(incident, from_attributes=True)


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident(
    incident_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    incident = await db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.department_id == department.id,
        )
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return IncidentOut.model_validate(incident, from_attributes=True)


@router.get("/{incident_id}/neris", response_model=dict)
async def export_neris(
    incident_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return NERIS-compliant JSON for a single incident."""
    incident = await db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.department_id == department.id,
        )
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return to_neris_json(incident, department)


@router.patch("/{incident_id}", response_model=IncidentOut)
async def update_incident(
    incident_id: uuid.UUID,
    payload: IncidentUpdateRequest,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    incident = await db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.department_id == department.id,
        )
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    updates = payload.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        setattr(incident, field_name, value)

    await db.commit()
    await db.refresh(incident)
    return IncidentOut.model_validate(incident, from_attributes=True)


@router.delete("/{incident_id}", status_code=204)
async def delete_incident(
    incident_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> None:
    incident = await db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.department_id == department.id,
        )
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    await db.delete(incident)
    await db.commit()
