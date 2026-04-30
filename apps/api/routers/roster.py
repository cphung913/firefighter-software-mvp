import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, require_admin
from core.security import hash_password
from models.department import Department
from models.user import User
from schemas.auth import UserOut
from schemas.roster import PersonnelCreateRequest

router = APIRouter(prefix="/roster", tags=["roster"])


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def add_personnel(
    payload: PersonnelCreateRequest,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    if payload.email:
        existing = await db.scalar(select(User).where(User.email == payload.email))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="email already registered",
            )

    email = payload.email
    if not email:
        email = f"imported.{secrets.token_hex(4)}@import.local"

    user = User(
        department_id=department.id,
        name=payload.name,
        email=email,
        password_hash=hash_password(secrets.token_urlsafe(16)),
        role=payload.role or "member",
        badge_number=payload.badge_number,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserOut.model_validate(user, from_attributes=True)
