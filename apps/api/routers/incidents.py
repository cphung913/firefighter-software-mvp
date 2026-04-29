import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import APIRouter, Depends, HTTPException

from core.db import get_db
from core.deps import get_current_department, get_current_user, require_admin
from models.department import Department
from models.incident import Incident
from models.user import User
from schemas.incident import (
    IncidentBootstrapResponse,
    IncidentRosterUserOut,
    IncidentUpdateRequest,
)
from schemas.assets import ApparatusOut
from services.assets_service import get_apparatus_list

router = APIRouter(prefix="/incidents", tags=["incidents"])


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


@router.patch("/{incident_id}", response_model=dict)
async def update_incident(
    incident_id: uuid.UUID,
    payload: IncidentUpdateRequest,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> dict:
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
    return {"id": str(incident.id)}


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
