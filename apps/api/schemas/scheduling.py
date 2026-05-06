from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


# ===== Shift Patterns =====

class ShiftPatternCreate(BaseModel):
    name: str
    pattern_type: str = "48_96"
    cycle_length_days: int = 6
    on_days: int = 2
    off_days: int = 4
    kelly_day_interval: Optional[int] = None
    start_date: date
    is_active: bool = True


class ShiftPatternUpdate(BaseModel):
    name: Optional[str] = None
    pattern_type: Optional[str] = None
    cycle_length_days: Optional[int] = None
    on_days: Optional[int] = None
    off_days: Optional[int] = None
    kelly_day_interval: Optional[int] = None
    start_date: Optional[date] = None
    is_active: Optional[bool] = None


class ShiftPatternOut(BaseModel):
    id: UUID
    department_id: UUID
    name: str
    pattern_type: str
    cycle_length_days: int
    on_days: int
    off_days: int
    kelly_day_interval: Optional[int]
    start_date: date
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===== Shift Groups =====

class ShiftGroupCreate(BaseModel):
    pattern_id: UUID
    name: str
    color: str = "#3b82f6"
    cycle_offset_days: int = 0


class ShiftGroupUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    cycle_offset_days: Optional[int] = None


class ShiftGroupOut(BaseModel):
    id: UUID
    department_id: UUID
    pattern_id: UUID
    name: str
    color: str
    cycle_offset_days: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===== Shift Assignments =====

class ShiftAssignmentCreate(BaseModel):
    user_id: UUID
    group_id: UUID
    start_date: date
    end_date: Optional[date] = None


class ShiftAssignmentUpdate(BaseModel):
    end_date: Optional[date] = None
    group_id: Optional[UUID] = None


class ShiftAssignmentOut(BaseModel):
    id: UUID
    department_id: UUID
    user_id: UUID
    group_id: UUID
    start_date: date
    end_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===== Leave Requests =====

class LeaveRequestCreate(BaseModel):
    leave_type: str = "vacation"
    start_date: date
    end_date: date
    notes: Optional[str] = None


class LeaveRequestReview(BaseModel):
    status: str  # approved | denied


class LeaveRequestOut(BaseModel):
    id: UUID
    department_id: UUID
    user_id: UUID
    leave_type: str
    start_date: date
    end_date: date
    notes: Optional[str]
    status: str
    reviewed_by: Optional[UUID]
    reviewed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===== Shift Trades =====

class ShiftTradeCreate(BaseModel):
    recipient_id: UUID
    trade_date: date
    return_date: Optional[date] = None
    notes: Optional[str] = None


class ShiftTradeReview(BaseModel):
    status: str  # approved | denied


class ShiftTradeOut(BaseModel):
    id: UUID
    department_id: UUID
    requester_id: UUID
    recipient_id: UUID
    trade_date: date
    return_date: Optional[date]
    notes: Optional[str]
    status: str
    approved_by: Optional[UUID]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===== Calendar =====

class CalendarUserOut(BaseModel):
    id: UUID
    name: str
    badge_number: Optional[str]
    group_name: str
    group_color: str


class CalendarDayOut(BaseModel):
    date: date
    on_duty: list[CalendarUserOut]
    leave_count: int
    trade_count: int
    staffing_ok: bool


class StaffingDayOut(BaseModel):
    date: date
    scheduled: int
    on_leave: int
    effective: int
    minimum: int
    ok: bool
