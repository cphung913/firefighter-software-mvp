from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, get_current_user
from models.department import Department
from models.user import User
from schemas.sync import SyncPullResponse, SyncPushRequest, SyncPushResponse
from services.sync_service import apply_push, collect_pull

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/push", response_model=SyncPushResponse)
async def push(
    payload: SyncPushRequest,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> SyncPushResponse:
    return await apply_push(
        db,
        department_id=department.id,
        user_id=user.id,
        mutations=payload.mutations,
    )


@router.get("/pull", response_model=SyncPullResponse)
async def pull(
    since: datetime | None = Query(default=None),
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> SyncPullResponse:
    changes = await collect_pull(db, department_id=department.id, since=since)
    return SyncPullResponse(
        changes=changes,
        server_time=datetime.now(timezone.utc),
    )
