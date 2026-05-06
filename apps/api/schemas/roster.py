from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class PersonnelCreateRequest(BaseModel):
    name: str
    email: EmailStr | None = None
    role: str | None = None
    badge_number: str | None = None


class PersonnelUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    badge_number: Optional[str] = None


class RosterMemberOut(BaseModel):
    id: UUID
    department_id: UUID
    name: str
    email: str
    role: str
    badge_number: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ShiftAssignmentBrief(BaseModel):
    id: UUID
    group_id: UUID
    group_name: str
    group_color: str
    start_date: date


class RosterMemberDetailOut(BaseModel):
    id: UUID
    department_id: UUID
    name: str
    email: str
    role: str
    badge_number: Optional[str]
    created_at: datetime
    shift_assignment: Optional[ShiftAssignmentBrief]
    training_hours_ytd: float
    cert_count: int
    expiring_cert_count: int
