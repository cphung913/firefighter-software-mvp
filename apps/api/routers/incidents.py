import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, get_current_user, require_admin
from models.department import Department
from models.incident import Incident
from models.user import User
from schemas.assets import ApparatusOut
from schemas.incident import (
    IncidentBootstrapResponse,
    IncidentCreateRequest,
    IncidentOut,
    IncidentRosterUserOut,
    IncidentTaxonomyResponse,
    IncidentUpdateRequest,
    TaxonomyOption,
)
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
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> IncidentBootstrapResponse:
    apparatus = await get_apparatus_list(db, department_id=department.id)
    roster = await db.scalars(
        select(User)
        .where(User.department_id == department.id)
        .order_by(User.name)
    )

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
