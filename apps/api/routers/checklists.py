from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_user
from models.user import User
from schemas.checklist import (
    ChecklistApparatusOut,
    ChecklistBootstrapResponse,
    ChecklistTemplateOut,
)
from services.checklist_service import get_checklist_bootstrap

router = APIRouter(prefix="/checklists", tags=["checklists"])


@router.get("/templates", response_model=ChecklistBootstrapResponse)
async def list_templates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChecklistBootstrapResponse:
    templates, apparatus = await get_checklist_bootstrap(
        db,
        department_id=user.department_id,
    )
    return ChecklistBootstrapResponse(
        templates=[
            ChecklistTemplateOut.model_validate(template, from_attributes=True)
            for template in templates
        ],
        apparatus=[
            ChecklistApparatusOut.model_validate(unit, from_attributes=True)
            for unit in apparatus
        ],
    )
