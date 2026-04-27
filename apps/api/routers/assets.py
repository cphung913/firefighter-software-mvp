from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_user
from models.user import User
from schemas.assets import AssetBootstrapResponse, AssetPpeItemOut, AssetScbaUnitOut
from schemas.checklist import ChecklistApparatusOut
from schemas.incident import IncidentRosterUserOut
from services.assets_service import get_assets_bootstrap

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/bootstrap", response_model=AssetBootstrapResponse)
async def bootstrap_assets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssetBootstrapResponse:
    apparatus, ppe_items, scba_units, roster = await get_assets_bootstrap(
        db,
        department_id=user.department_id,
    )
    return AssetBootstrapResponse(
        apparatus=[
            ChecklistApparatusOut.model_validate(unit, from_attributes=True)
            for unit in apparatus
        ],
        ppe_items=[
            AssetPpeItemOut.model_validate(item, from_attributes=True)
            for item in ppe_items
        ],
        scba_units=[
            AssetScbaUnitOut.model_validate(unit, from_attributes=True)
            for unit in scba_units
        ],
        users=[
            IncidentRosterUserOut(
                id=str(member.id),
                name=member.name,
                role=member.role,
                badge_number=member.badge_number,
            )
            for member in roster
        ],
    )


@router.get("/apparatus", response_model=list[ChecklistApparatusOut])
async def list_apparatus(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChecklistApparatusOut]:
    apparatus, _, _, _ = await get_assets_bootstrap(db, department_id=user.department_id)
    return [
        ChecklistApparatusOut.model_validate(unit, from_attributes=True)
        for unit in apparatus
    ]


@router.get("/ppe", response_model=list[AssetPpeItemOut])
async def list_ppe(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AssetPpeItemOut]:
    _, ppe_items, _, _ = await get_assets_bootstrap(db, department_id=user.department_id)
    return [
        AssetPpeItemOut.model_validate(item, from_attributes=True) for item in ppe_items
    ]


@router.get("/scba", response_model=list[AssetScbaUnitOut])
async def list_scba(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AssetScbaUnitOut]:
    _, _, scba_units, _ = await get_assets_bootstrap(
        db, department_id=user.department_id
    )
    return [
        AssetScbaUnitOut.model_validate(unit, from_attributes=True)
        for unit in scba_units
    ]
