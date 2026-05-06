from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


# ===== Training Drills =====

class TrainingDrillCreate(BaseModel):
    drill_type: str = "other"
    title: str
    description: Optional[str] = None
    drill_date: datetime
    hours: float = 1.0
    instructor: Optional[str] = None
    location: Optional[str] = None
    iso_category: Optional[str] = None
    attendee_ids: list[UUID] = []


class TrainingDrillUpdate(BaseModel):
    drill_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    drill_date: Optional[datetime] = None
    hours: Optional[float] = None
    instructor: Optional[str] = None
    location: Optional[str] = None
    iso_category: Optional[str] = None


class AttendeeOut(BaseModel):
    id: UUID
    name: str
    badge_number: Optional[str]
    role: str


class TrainingDrillOut(BaseModel):
    id: UUID
    department_id: UUID
    drill_type: str
    title: str
    description: Optional[str]
    drill_date: datetime
    hours: float
    instructor: Optional[str]
    location: Optional[str]
    iso_category: Optional[str]
    created_by: Optional[UUID]
    attendee_count: int
    attendees: list[AttendeeOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AttendeeAddRequest(BaseModel):
    user_ids: list[UUID]


# ===== Certifications =====

class CertificationCreate(BaseModel):
    user_id: UUID
    cert_type: str
    cert_number: Optional[str] = None
    issuing_body: Optional[str] = None
    issued_date: date
    expiry_date: date
    status: str = "active"
    document_ref: Optional[str] = None


class CertificationUpdate(BaseModel):
    cert_type: Optional[str] = None
    cert_number: Optional[str] = None
    issuing_body: Optional[str] = None
    issued_date: Optional[date] = None
    expiry_date: Optional[date] = None
    status: Optional[str] = None
    document_ref: Optional[str] = None


class CertificationOut(BaseModel):
    id: UUID
    department_id: UUID
    user_id: UUID
    cert_type: str
    cert_number: Optional[str]
    issuing_body: Optional[str]
    issued_date: date
    expiry_date: date
    status: str
    document_ref: Optional[str]
    days_until_expiry: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===== Member Training Summary =====

class MemberTrainingSummary(BaseModel):
    user_id: UUID
    name: str
    badge_number: Optional[str]
    role: str
    total_hours_ytd: float
    total_drills_ytd: int
    hours_by_category: dict[str, float]
    certifications: list[CertificationOut]
    expiring_soon: int  # certs expiring within 90 days


# ===== ISO Report =====

class ISOCategoryStats(BaseModel):
    category: str
    total_hours: float
    drill_count: int
    member_count: int


class ISOReportOut(BaseModel):
    department_id: UUID
    year: int
    total_training_hours: float
    total_drills: int
    member_compliance_pct: float
    categories: list[ISOCategoryStats]
    generated_at: datetime
