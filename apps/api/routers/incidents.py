from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import APIRouter, Depends

from core.db import get_db
from core.deps import get_current_user
from models.user import User
from schemas.incident import IncidentBootstrapResponse, IncidentRosterUserOut
from schemas.assets import ApparatusOut
from services.assets_service import get_apparatus_list

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("/bootstrap", response_model=IncidentBootstrapResponse)
async def bootstrap_incident_form(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IncidentBootstrapResponse:
    apparatus = await get_apparatus_list(db, department_id=user.department_id)
    roster = await db.scalars(
        select(User)
        .where(User.department_id == user.department_id)
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
