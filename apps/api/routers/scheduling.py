import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, get_current_user, require_admin
from models.department import Department
from models.scheduling import (
    LeaveRequest,
    ShiftAssignment,
    ShiftGroup,
    ShiftPattern,
    ShiftTrade,
)
from models.user import User
from schemas.scheduling import (
    CalendarDayOut,
    CalendarUserOut,
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveRequestReview,
    ShiftAssignmentCreate,
    ShiftAssignmentOut,
    ShiftAssignmentUpdate,
    ShiftGroupCreate,
    ShiftGroupOut,
    ShiftGroupUpdate,
    ShiftPatternCreate,
    ShiftPatternOut,
    ShiftPatternUpdate,
    ShiftTradeCreate,
    ShiftTradeOut,
    ShiftTradeReview,
    StaffingDayOut,
)

router = APIRouter(prefix="/scheduling", tags=["scheduling"])


# ===== Shift Patterns =====

@router.get("/patterns", response_model=list[ShiftPatternOut])
async def list_patterns(
    department: Department = Depends(get_current_department),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ShiftPatternOut]:
    result = await db.execute(
        select(ShiftPattern).where(
            ShiftPattern.department_id == department.id,
            ShiftPattern.is_active.is_(True),
        )
    )
    return result.scalars().all()


@router.post("/patterns", response_model=ShiftPatternOut, status_code=status.HTTP_201_CREATED)
async def create_pattern(
    payload: ShiftPatternCreate,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> ShiftPatternOut:
    if payload.cycle_length_days <= 0:
        raise HTTPException(status_code=400, detail="cycle_length_days must be > 0")
    if payload.on_days > payload.cycle_length_days:
        raise HTTPException(status_code=400, detail="on_days cannot exceed cycle_length_days")

    pattern = ShiftPattern(department_id=department.id, **payload.model_dump())
    db.add(pattern)
    await db.commit()
    await db.refresh(pattern)
    return ShiftPatternOut.model_validate(pattern, from_attributes=True)


@router.patch("/patterns/{pattern_id}", response_model=ShiftPatternOut)
async def update_pattern(
    pattern_id: uuid.UUID,
    payload: ShiftPatternUpdate,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> ShiftPatternOut:
    pattern = await db.scalar(
        select(ShiftPattern).where(
            ShiftPattern.id == pattern_id,
            ShiftPattern.department_id == department.id,
        )
    )
    if pattern is None:
        raise HTTPException(status_code=404, detail="Shift pattern not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pattern, field, value)
    await db.commit()
    await db.refresh(pattern)
    return ShiftPatternOut.model_validate(pattern, from_attributes=True)


# ===== Shift Groups =====

@router.get("/groups", response_model=list[ShiftGroupOut])
async def list_groups(
    pattern_id: Optional[uuid.UUID] = Query(None),
    department: Department = Depends(get_current_department),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ShiftGroupOut]:
    q = select(ShiftGroup).where(ShiftGroup.department_id == department.id)
    if pattern_id is not None:
        q = q.where(ShiftGroup.pattern_id == pattern_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/groups", response_model=ShiftGroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: ShiftGroupCreate,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> ShiftGroupOut:
    pattern = await db.scalar(
        select(ShiftPattern).where(
            ShiftPattern.id == payload.pattern_id,
            ShiftPattern.department_id == department.id,
        )
    )
    if pattern is None:
        raise HTTPException(status_code=404, detail="Shift pattern not found")
    group = ShiftGroup(department_id=department.id, **payload.model_dump())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return ShiftGroupOut.model_validate(group, from_attributes=True)


@router.patch("/groups/{group_id}", response_model=ShiftGroupOut)
async def update_group(
    group_id: uuid.UUID,
    payload: ShiftGroupUpdate,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> ShiftGroupOut:
    group = await db.scalar(
        select(ShiftGroup).where(
            ShiftGroup.id == group_id,
            ShiftGroup.department_id == department.id,
        )
    )
    if group is None:
        raise HTTPException(status_code=404, detail="Shift group not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    await db.commit()
    await db.refresh(group)
    return ShiftGroupOut.model_validate(group, from_attributes=True)


# ===== Shift Assignments =====

@router.get("/assignments", response_model=list[ShiftAssignmentOut])
async def list_assignments(
    user_id: Optional[uuid.UUID] = Query(None),
    group_id: Optional[uuid.UUID] = Query(None),
    department: Department = Depends(get_current_department),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ShiftAssignmentOut]:
    q = select(ShiftAssignment).where(ShiftAssignment.department_id == department.id)
    if user_id is not None:
        q = q.where(ShiftAssignment.user_id == user_id)
    if group_id is not None:
        q = q.where(ShiftAssignment.group_id == group_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/assignments", response_model=ShiftAssignmentOut, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    payload: ShiftAssignmentCreate,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> ShiftAssignmentOut:
    member = await db.scalar(
        select(User).where(User.id == payload.user_id, User.department_id == department.id)
    )
    if member is None:
        raise HTTPException(status_code=404, detail="User not found")
    group = await db.scalar(
        select(ShiftGroup).where(
            ShiftGroup.id == payload.group_id,
            ShiftGroup.department_id == department.id,
        )
    )
    if group is None:
        raise HTTPException(status_code=404, detail="Shift group not found")
    assignment = ShiftAssignment(department_id=department.id, **payload.model_dump())
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return ShiftAssignmentOut.model_validate(assignment, from_attributes=True)


@router.patch("/assignments/{assignment_id}", response_model=ShiftAssignmentOut)
async def update_assignment(
    assignment_id: uuid.UUID,
    payload: ShiftAssignmentUpdate,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> ShiftAssignmentOut:
    assignment = await db.scalar(
        select(ShiftAssignment).where(
            ShiftAssignment.id == assignment_id,
            ShiftAssignment.department_id == department.id,
        )
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(assignment, field, value)
    await db.commit()
    await db.refresh(assignment)
    return ShiftAssignmentOut.model_validate(assignment, from_attributes=True)


# ===== Calendar helpers =====

def _is_on_duty(check_date: date, pattern: ShiftPattern, group: ShiftGroup) -> bool:
    if pattern.cycle_length_days <= 0:
        return False
    delta_days = (check_date - pattern.start_date).days - group.cycle_offset_days
    return (delta_days % pattern.cycle_length_days) < pattern.on_days


async def _load_calendar_data(
    db: AsyncSession,
    department: Department,
    start: date,
    end: date,
) -> tuple:
    assignments_result = await db.execute(
        select(ShiftAssignment).where(ShiftAssignment.department_id == department.id)
    )
    assignments = list(assignments_result.scalars().all())

    patterns_result = await db.execute(
        select(ShiftPattern).where(ShiftPattern.department_id == department.id)
    )
    patterns_by_id = {p.id: p for p in patterns_result.scalars().all()}

    groups_result = await db.execute(
        select(ShiftGroup).where(ShiftGroup.department_id == department.id)
    )
    groups_by_id = {g.id: g for g in groups_result.scalars().all()}

    users_result = await db.execute(
        select(User).where(User.department_id == department.id)
    )
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    leave_result = await db.execute(
        select(LeaveRequest).where(
            LeaveRequest.department_id == department.id,
            LeaveRequest.status == "approved",
            LeaveRequest.start_date <= end,
            LeaveRequest.end_date >= start,
        )
    )
    leave_users_by_date: dict[date, set] = {}
    for lr in leave_result.scalars().all():
        d = lr.start_date
        while d <= lr.end_date:
            if start <= d <= end:
                leave_users_by_date.setdefault(d, set()).add(lr.user_id)
            d += timedelta(days=1)

    trades_result = await db.execute(
        select(ShiftTrade).where(
            ShiftTrade.department_id == department.id,
            ShiftTrade.status == "approved",
            ShiftTrade.trade_date >= start,
            ShiftTrade.trade_date <= end,
        )
    )
    trades_by_date: dict[date, dict[str, set]] = {}
    for trade in trades_result.scalars().all():
        day = trades_by_date.setdefault(trade.trade_date, {"away": set(), "in": set()})
        day["away"].add(trade.requester_id)
        day["in"].add(trade.recipient_id)

    return assignments, patterns_by_id, groups_by_id, users_by_id, leave_users_by_date, trades_by_date


def _build_calendar_day(
    check_date: date,
    department: Department,
    assignments: list,
    patterns_by_id: dict,
    groups_by_id: dict,
    users_by_id: dict,
    leave_users_by_date: dict,
    trades_by_date: dict,
) -> CalendarDayOut:
    on_duty: list[CalendarUserOut] = []

    for assignment in assignments:
        if assignment.start_date > check_date:
            continue
        if assignment.end_date is not None and assignment.end_date < check_date:
            continue

        group = groups_by_id.get(assignment.group_id)
        if group is None:
            continue
        pattern = patterns_by_id.get(group.pattern_id)
        if pattern is None:
            continue
        if not _is_on_duty(check_date, pattern, group):
            continue

        user = users_by_id.get(assignment.user_id)
        if user is None:
            continue

        if assignment.user_id in leave_users_by_date.get(check_date, set()):
            continue
        if assignment.user_id in trades_by_date.get(check_date, {}).get("away", set()):
            continue

        on_duty.append(CalendarUserOut(
            id=user.id,
            name=user.name,
            badge_number=user.badge_number,
            group_name=group.name,
            group_color=group.color,
        ))

    existing_ids = {u.id for u in on_duty}
    for user_id in trades_by_date.get(check_date, {}).get("in", set()):
        if user_id in existing_ids:
            continue
        user = users_by_id.get(user_id)
        if user is None:
            continue
        on_duty.append(CalendarUserOut(
            id=user.id,
            name=user.name,
            badge_number=user.badge_number,
            group_name="Trade",
            group_color="#6b7280",
        ))

    leave_count = len(leave_users_by_date.get(check_date, set()))
    trade_count = len(trades_by_date.get(check_date, {}).get("away", set()))
    staffing_ok = len(on_duty) >= department.minimum_staffing if department.minimum_staffing is not None else True

    return CalendarDayOut(
        date=check_date,
        on_duty=on_duty,
        leave_count=leave_count,
        trade_count=trade_count,
        staffing_ok=staffing_ok,
    )


@router.get("/calendar", response_model=list[CalendarDayOut])
async def get_calendar(
    start: date = Query(...),
    end: date = Query(...),
    department: Department = Depends(get_current_department),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CalendarDayOut]:
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    if (end - start).days > 365:
        raise HTTPException(status_code=400, detail="date range cannot exceed 365 days")

    assignments, patterns_by_id, groups_by_id, users_by_id, leave_users_by_date, trades_by_date = (
        await _load_calendar_data(db, department, start, end)
    )

    days = []
    current = start
    while current <= end:
        days.append(_build_calendar_day(
            current, department, assignments, patterns_by_id, groups_by_id,
            users_by_id, leave_users_by_date, trades_by_date,
        ))
        current += timedelta(days=1)
    return days


# ===== Leave Requests =====

@router.post("/leave-requests", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED)
async def create_leave_request(
    payload: LeaveRequestCreate,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> LeaveRequestOut:
    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")
    lr = LeaveRequest(
        department_id=department.id,
        user_id=user.id,
        **payload.model_dump(),
    )
    db.add(lr)
    await db.commit()
    await db.refresh(lr)
    return LeaveRequestOut.model_validate(lr, from_attributes=True)


@router.get("/leave-requests", response_model=list[LeaveRequestOut])
async def list_leave_requests(
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[LeaveRequestOut]:
    q = select(LeaveRequest).where(LeaveRequest.department_id == department.id)
    if user.role == "member":
        q = q.where(LeaveRequest.user_id == user.id)
    result = await db.execute(q.order_by(LeaveRequest.start_date.desc()))
    return result.scalars().all()


@router.patch("/leave-requests/{request_id}", response_model=LeaveRequestOut)
async def review_leave_request(
    request_id: uuid.UUID,
    payload: LeaveRequestReview,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> LeaveRequestOut:
    lr = await db.scalar(
        select(LeaveRequest).where(
            LeaveRequest.id == request_id,
            LeaveRequest.department_id == department.id,
        )
    )
    if lr is None:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if lr.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot update a request with status '{lr.status}'")

    if payload.status == "cancelled":
        if lr.user_id != user.id:
            raise HTTPException(status_code=403, detail="Only the owner can cancel a leave request")
        lr.status = "cancelled"
    elif payload.status in ("approved", "denied"):
        if user.role not in ("admin", "officer"):
            raise HTTPException(status_code=403, detail="Only admins or officers can review leave requests")
        lr.status = payload.status
        lr.reviewed_by = user.id
        lr.reviewed_at = datetime.now(timezone.utc)
    else:
        raise HTTPException(status_code=400, detail="status must be one of: approved, denied, cancelled")

    await db.commit()
    await db.refresh(lr)
    return LeaveRequestOut.model_validate(lr, from_attributes=True)


# ===== Shift Trades =====

@router.post("/trades", response_model=ShiftTradeOut, status_code=status.HTTP_201_CREATED)
async def create_trade(
    payload: ShiftTradeCreate,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> ShiftTradeOut:
    recipient = await db.scalar(
        select(User).where(User.id == payload.recipient_id, User.department_id == department.id)
    )
    if recipient is None:
        raise HTTPException(status_code=404, detail="Recipient not found")
    if recipient.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot trade with yourself")

    trade = ShiftTrade(
        department_id=department.id,
        requester_id=user.id,
        **payload.model_dump(),
    )
    db.add(trade)
    await db.commit()
    await db.refresh(trade)
    return ShiftTradeOut.model_validate(trade, from_attributes=True)


@router.get("/trades", response_model=list[ShiftTradeOut])
async def list_trades(
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[ShiftTradeOut]:
    q = select(ShiftTrade).where(ShiftTrade.department_id == department.id)
    if user.role != "admin":
        q = q.where(
            or_(
                ShiftTrade.requester_id == user.id,
                ShiftTrade.recipient_id == user.id,
            )
        )
    result = await db.execute(q.order_by(ShiftTrade.trade_date.desc()))
    return result.scalars().all()


@router.patch("/trades/{trade_id}", response_model=ShiftTradeOut)
async def review_trade(
    trade_id: uuid.UUID,
    payload: ShiftTradeReview,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> ShiftTradeOut:
    trade = await db.scalar(
        select(ShiftTrade).where(
            ShiftTrade.id == trade_id,
            ShiftTrade.department_id == department.id,
        )
    )
    if trade is None:
        raise HTTPException(status_code=404, detail="Trade not found")

    if trade.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot update a trade with status '{trade.status}'")

    if payload.status == "cancelled":
        if trade.requester_id != user.id:
            raise HTTPException(status_code=403, detail="Only the requester can cancel a trade")
        trade.status = "cancelled"
    elif payload.status in ("approved", "denied"):
        if user.role not in ("admin", "officer"):
            raise HTTPException(status_code=403, detail="Only admins or officers can review trades")
        trade.status = payload.status
        trade.approved_by = user.id
        trade.approved_at = datetime.now(timezone.utc)
    else:
        raise HTTPException(status_code=400, detail="status must be one of: approved, denied, cancelled")

    await db.commit()
    await db.refresh(trade)
    return ShiftTradeOut.model_validate(trade, from_attributes=True)


# ===== Staffing =====

@router.get("/staffing", response_model=list[StaffingDayOut])
async def get_staffing(
    start: date = Query(...),
    end: date = Query(...),
    department: Department = Depends(get_current_department),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[StaffingDayOut]:
    if start > end:
        raise HTTPException(status_code=400, detail="start must be <= end")
    if (end - start).days > 365:
        raise HTTPException(status_code=400, detail="date range cannot exceed 365 days")

    assignments, patterns_by_id, groups_by_id, _users, leave_users_by_date, trades_by_date = (
        await _load_calendar_data(db, department, start, end)
    )

    minimum_staffing: int = department.minimum_staffing or 0

    days = []
    current = start
    while current <= end:
        scheduled = 0
        for assignment in assignments:
            if assignment.start_date > current:
                continue
            if assignment.end_date is not None and assignment.end_date < current:
                continue
            group = groups_by_id.get(assignment.group_id)
            if group is None:
                continue
            pattern = patterns_by_id.get(group.pattern_id)
            if pattern is None:
                continue
            if _is_on_duty(current, pattern, group):
                scheduled += 1

        on_leave = len(leave_users_by_date.get(current, set()))
        trade_away = len(trades_by_date.get(current, {}).get("away", set()))
        trade_in = len(trades_by_date.get(current, {}).get("in", set()))
        effective = max(0, scheduled - on_leave - trade_away + trade_in)

        days.append(StaffingDayOut(
            date=current,
            scheduled=scheduled,
            on_leave=on_leave,
            effective=effective,
            minimum=minimum_staffing,
            ok=effective >= minimum_staffing,
        ))
        current += timedelta(days=1)
    return days
