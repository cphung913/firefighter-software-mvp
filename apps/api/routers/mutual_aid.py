import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, get_current_user, require_admin
from models.department import Department
from models.incident import Incident
from models.mutual_aid import MutualAidAgency, MutualAidAssignment
from models.user import User
from schemas.mutual_aid import (
    MutualAidAgencyCreateRequest,
    MutualAidAgencyOut,
    MutualAidAgencyUpdateRequest,
    MutualAidAssignmentCreateRequest,
    MutualAidAssignmentOut,
    MutualAidAssignmentUpdateRequest,
)

agencies_router = APIRouter(prefix="/mutual-aid", tags=["mutual-aid"])
incidents_mutual_aid_router = APIRouter(prefix="/incidents", tags=["mutual-aid"])


def _assignment_out(row: MutualAidAssignment, agency_name: str | None) -> MutualAidAssignmentOut:
    return MutualAidAssignmentOut(
        id=row.id,
        incident_id=row.incident_id,
        department_id=row.department_id,
        agency_id=row.agency_id,
        agency_name=agency_name,
        agency_name_override=row.agency_name_override,
        units_assigned=row.units_assigned,
        status=row.status,
        notes=row.notes,
        assigned_by=row.assigned_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _resolve_agency_name(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    row: MutualAidAssignment,
) -> str | None:
    if row.agency_id is not None:
        agency = await db.scalar(
            select(MutualAidAgency).where(
                MutualAidAgency.id == row.agency_id,
                MutualAidAgency.department_id == department_id,
            )
        )
        if agency is not None:
            return agency.name
    if row.agency_name_override and row.agency_name_override.strip():
        return row.agency_name_override.strip()
    return None


# --- Agencies ---


@agencies_router.get("/agencies", response_model=list[MutualAidAgencyOut])
async def list_agencies(
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[MutualAidAgencyOut]:
    result = await db.scalars(
        select(MutualAidAgency)
        .where(MutualAidAgency.department_id == department.id)
        .order_by(MutualAidAgency.name)
    )
    return [MutualAidAgencyOut.model_validate(r, from_attributes=True) for r in result.all()]


@agencies_router.post(
    "/agencies",
    response_model=MutualAidAgencyOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_agency(
    payload: MutualAidAgencyCreateRequest,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> MutualAidAgencyOut:
    data = payload.model_dump(exclude_unset=True)
    agency = MutualAidAgency(department_id=department.id, **data)
    db.add(agency)
    await db.commit()
    await db.refresh(agency)
    return MutualAidAgencyOut.model_validate(agency, from_attributes=True)


@agencies_router.patch("/agencies/{agency_id}", response_model=MutualAidAgencyOut)
async def update_agency(
    agency_id: uuid.UUID,
    payload: MutualAidAgencyUpdateRequest,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> MutualAidAgencyOut:
    agency = await db.scalar(
        select(MutualAidAgency).where(
            MutualAidAgency.id == agency_id,
            MutualAidAgency.department_id == department.id,
        )
    )
    if agency is None:
        raise HTTPException(status_code=404, detail="Agency not found")

    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(agency, k, v)

    await db.commit()
    await db.refresh(agency)
    return MutualAidAgencyOut.model_validate(agency, from_attributes=True)


@agencies_router.delete("/agencies/{agency_id}", status_code=204)
async def delete_agency(
    agency_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> None:
    agency = await db.scalar(
        select(MutualAidAgency).where(
            MutualAidAgency.id == agency_id,
            MutualAidAgency.department_id == department.id,
        )
    )
    if agency is None:
        raise HTTPException(status_code=404, detail="Agency not found")
    await db.delete(agency)
    await db.commit()


# --- Incident assignments ---


@incidents_mutual_aid_router.get(
    "/{incident_id}/mutual-aid",
    response_model=list[MutualAidAssignmentOut],
)
async def list_assignments(
    incident_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[MutualAidAssignmentOut]:
    inc = await db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.department_id == department.id,
        )
    )
    if inc is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    rows = (
        await db.scalars(
            select(MutualAidAssignment)
            .where(
                MutualAidAssignment.incident_id == incident_id,
                MutualAidAssignment.department_id == department.id,
            )
            .order_by(MutualAidAssignment.created_at)
        )
    ).all()

    out: list[MutualAidAssignmentOut] = []
    for row in rows:
        name = await _resolve_agency_name(db, department_id=department.id, row=row)
        out.append(_assignment_out(row, name))
    return out


@incidents_mutual_aid_router.post(
    "/{incident_id}/mutual-aid",
    response_model=MutualAidAssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_assignment(
    incident_id: uuid.UUID,
    payload: MutualAidAssignmentCreateRequest,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> MutualAidAssignmentOut:
    inc = await db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.department_id == department.id,
        )
    )
    if inc is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    agency_id = payload.agency_id
    override = payload.agency_name_override.strip() if payload.agency_name_override else None

    if agency_id is not None:
        agency = await db.scalar(
            select(MutualAidAgency).where(
                MutualAidAgency.id == agency_id,
                MutualAidAgency.department_id == department.id,
            )
        )
        if agency is None:
            raise HTTPException(status_code=400, detail="Agency not found")
        override = None
    elif not override:
        raise HTTPException(status_code=400, detail="agency_id or agency_name_override is required")

    assignment = MutualAidAssignment(
        incident_id=incident_id,
        department_id=department.id,
        agency_id=agency_id,
        agency_name_override=override,
        units_assigned=payload.units_assigned,
        status=payload.status,
        notes=payload.notes,
        assigned_by=user.id,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    name = await _resolve_agency_name(db, department_id=department.id, row=assignment)
    return _assignment_out(assignment, name)


@incidents_mutual_aid_router.patch(
    "/{incident_id}/mutual-aid/{assignment_id}",
    response_model=MutualAidAssignmentOut,
)
async def update_assignment(
    incident_id: uuid.UUID,
    assignment_id: uuid.UUID,
    payload: MutualAidAssignmentUpdateRequest,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> MutualAidAssignmentOut:
    row = await db.scalar(
        select(MutualAidAssignment).where(
            MutualAidAssignment.id == assignment_id,
            MutualAidAssignment.incident_id == incident_id,
            MutualAidAssignment.department_id == department.id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(row, k, v)

    await db.commit()
    await db.refresh(row)

    name = await _resolve_agency_name(db, department_id=department.id, row=row)
    return _assignment_out(row, name)


@incidents_mutual_aid_router.delete(
    "/{incident_id}/mutual-aid/{assignment_id}",
    status_code=204,
)
async def delete_assignment(
    incident_id: uuid.UUID,
    assignment_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> None:
    row = await db.scalar(
        select(MutualAidAssignment).where(
            MutualAidAssignment.id == assignment_id,
            MutualAidAssignment.incident_id == incident_id,
            MutualAidAssignment.department_id == department.id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(row)
    await db.commit()
