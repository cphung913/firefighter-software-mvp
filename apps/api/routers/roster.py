import secrets
import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, get_current_user, require_admin
from core.security import hash_password
from models.department import Department
from models.scheduling import ShiftAssignment, ShiftGroup
from models.training import Certification, TrainingAttendee, TrainingDrill
from models.user import User
from schemas.auth import UserOut
from schemas.roster import (
    PersonnelCreateRequest,
    PersonnelUpdateRequest,
    RosterMemberDetailOut,
    RosterMemberOut,
    ShiftAssignmentBrief,
)

router = APIRouter(prefix="/roster", tags=["roster"])


@router.get("", response_model=list[RosterMemberOut])
async def list_roster(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[RosterMemberOut]:
    q = select(User).where(User.department_id == department.id)
    if search:
        q = q.where(User.name.ilike(f"%{search}%"))
    if role:
        q = q.where(User.role == role)
    q = q.order_by(User.name)
    result = await db.execute(q)
    return result.scalars().all()


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


@router.get("/{user_id}", response_model=RosterMemberDetailOut)
async def get_member(
    user_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> RosterMemberDetailOut:
    member = await db.scalar(
        select(User).where(User.id == user_id, User.department_id == department.id)
    )
    if member is None:
        raise HTTPException(status_code=404, detail="User not found")

    today = date.today()
    current_year = today.year

    active_assignment = await db.scalar(
        select(ShiftAssignment).where(
            ShiftAssignment.user_id == user_id,
            ShiftAssignment.department_id == department.id,
            ShiftAssignment.start_date <= today,
            or_(
                ShiftAssignment.end_date.is_(None),
                ShiftAssignment.end_date >= today,
            ),
        ).order_by(ShiftAssignment.start_date.desc())
    )

    shift_assignment_brief: Optional[ShiftAssignmentBrief] = None
    if active_assignment is not None:
        group = await db.scalar(
            select(ShiftGroup).where(ShiftGroup.id == active_assignment.group_id)
        )
        if group is not None:
            shift_assignment_brief = ShiftAssignmentBrief(
                id=active_assignment.id,
                group_id=group.id,
                group_name=group.name,
                group_color=group.color,
                start_date=active_assignment.start_date,
            )

    training_hours_ytd = await db.scalar(
        select(func.coalesce(func.sum(TrainingDrill.hours), 0))
        .join(TrainingAttendee, TrainingAttendee.drill_id == TrainingDrill.id)
        .where(
            TrainingAttendee.user_id == user_id,
            TrainingDrill.department_id == department.id,
            TrainingDrill.is_deleted.is_(False),
            extract("year", TrainingDrill.drill_date) == current_year,
        )
    ) or 0

    cert_count = await db.scalar(
        select(func.count()).where(
            Certification.user_id == user_id,
            Certification.department_id == department.id,
        )
    ) or 0

    cutoff_90 = today + timedelta(days=90)
    expiring_cert_count = await db.scalar(
        select(func.count()).where(
            Certification.user_id == user_id,
            Certification.department_id == department.id,
            Certification.expiry_date >= today,
            Certification.expiry_date <= cutoff_90,
        )
    ) or 0

    return RosterMemberDetailOut(
        id=member.id,
        department_id=member.department_id,
        name=member.name,
        email=member.email,
        role=member.role,
        badge_number=member.badge_number,
        created_at=member.created_at,
        shift_assignment=shift_assignment_brief,
        training_hours_ytd=float(training_hours_ytd),
        cert_count=cert_count,
        expiring_cert_count=expiring_cert_count,
    )


@router.patch("/{user_id}", response_model=RosterMemberOut)
async def update_member(
    user_id: uuid.UUID,
    payload: PersonnelUpdateRequest,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> RosterMemberOut:
    member = await db.scalar(
        select(User).where(User.id == user_id, User.department_id == department.id)
    )
    if member is None:
        raise HTTPException(status_code=404, detail="User not found")

    updates = payload.model_dump(exclude_unset=True)
    if "email" in updates and updates["email"] != member.email:
        conflict = await db.scalar(select(User).where(User.email == updates["email"]))
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="email already registered",
            )

    for field, value in updates.items():
        setattr(member, field, value)

    await db.commit()
    await db.refresh(member)
    return RosterMemberOut.model_validate(member, from_attributes=True)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> None:
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    member = await db.scalar(
        select(User).where(User.id == user_id, User.department_id == department.id)
    )
    if member is None:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(member)
    await db.commit()
