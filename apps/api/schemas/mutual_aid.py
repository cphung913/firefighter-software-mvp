import uuid
from datetime import datetime

from pydantic import BaseModel, model_validator


class MutualAidAgencyOut(BaseModel):
    id: uuid.UUID
    department_id: uuid.UUID
    name: str
    agency_type: str | None
    contact_name: str | None
    contact_phone: str | None
    radio_channel: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MutualAidAgencyCreateRequest(BaseModel):
    name: str
    agency_type: str | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    radio_channel: str | None = None
    notes: str | None = None


class MutualAidAgencyUpdateRequest(BaseModel):
    name: str | None = None
    agency_type: str | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    radio_channel: str | None = None
    notes: str | None = None


class MutualAidAssignmentOut(BaseModel):
    id: uuid.UUID
    incident_id: uuid.UUID
    department_id: uuid.UUID
    agency_id: uuid.UUID | None
    agency_name: str | None
    agency_name_override: str | None
    units_assigned: str | None
    status: str
    notes: str | None
    assigned_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class MutualAidAssignmentCreateRequest(BaseModel):
    agency_id: uuid.UUID | None = None
    agency_name_override: str | None = None
    units_assigned: str | None = None
    status: str = "requested"
    notes: str | None = None

    @model_validator(mode="after")
    def require_agency(self) -> "MutualAidAssignmentCreateRequest":
        if self.agency_id is not None:
            return self
        if self.agency_name_override and self.agency_name_override.strip():
            return self
        raise ValueError("agency_id or agency_name_override is required")


class MutualAidAssignmentUpdateRequest(BaseModel):
    units_assigned: str | None = None
    status: str | None = None
    notes: str | None = None
