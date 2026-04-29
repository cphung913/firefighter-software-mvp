import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_user
from models.apparatus import Apparatus
from models.user import User
from schemas.assets import ApparatusOut, ApparatusStatusUpdate
from services.assets_service import get_apparatus_list

router = APIRouter(prefix="/assets", tags=["assets"])

VALID_STATUSES = {"available", "responding", "out_of_service"}


@router.get("/apparatus", response_model=list[ApparatusOut])
async def list_apparatus(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ApparatusOut]:
    rows = await get_apparatus_list(db, department_id=user.department_id)
    return [ApparatusOut.model_validate(unit, from_attributes=True) for unit in rows]


@router.patch("/apparatus/{apparatus_id}/status", response_model=ApparatusOut)
async def update_apparatus_status(
    apparatus_id: uuid.UUID,
    body: ApparatusStatusUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApparatusOut:
    if body.service_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"service_status must be one of {sorted(VALID_STATUSES)}",
        )
    unit = await db.scalar(
        select(Apparatus).where(
            Apparatus.id == apparatus_id,
            Apparatus.department_id == user.department_id,
        )
    )
    if unit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apparatus not found")
    unit.service_status = body.service_status
    await db.commit()
    await db.refresh(unit)
    return ApparatusOut.model_validate(unit, from_attributes=True)
