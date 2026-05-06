import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from schemas.assets import ApparatusOut
from schemas.scheduling import ShiftAssignmentOut, ShiftGroupOut


class IncidentRosterUserOut(BaseModel):
    id: str
    name: str
    role: str
    badge_number: str | None


class IncidentBootstrapResponse(BaseModel):
    apparatus: list[ApparatusOut]
    users: list[IncidentRosterUserOut]
    shift_groups: list[ShiftGroupOut] = []
    shift_assignments: list[ShiftAssignmentOut] = []
    my_assignment: ShiftAssignmentOut | None = None
    expiring_certs_count: int = 0


class IncidentCreateRequest(BaseModel):
    local_id: str | None = None
    incident_type: str | None = None
    location_address: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    alarm_time: datetime | None = None
    dispatch_time: datetime | None = None
    en_route_time: datetime | None = None
    on_scene_time: datetime | None = None
    controlled_time: datetime | None = None
    cleared_time: datetime | None = None
    units_responding: list[str] | None = None
    personnel_on_scene: list[str] | None = None
    casualty_civilian: int | None = None
    casualty_ff: int | None = None
    narrative: str | None = None
    actions_taken: list[str] | None = None
    property_use: str | None = None
    raw_data: dict[str, Any] | None = None


class IncidentUpdateRequest(BaseModel):
    incident_number: str | None = None
    incident_type: str | None = None
    location_address: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    alarm_time: datetime | None = None
    dispatch_time: datetime | None = None
    en_route_time: datetime | None = None
    on_scene_time: datetime | None = None
    controlled_time: datetime | None = None
    cleared_time: datetime | None = None
    units_responding: list[str] | None = None
    personnel_on_scene: list[str] | None = None
    casualty_civilian: int | None = None
    casualty_ff: int | None = None
    narrative: str | None = None
    actions_taken: list[str] | None = None
    property_use: str | None = None
    raw_data: dict[str, Any] | None = None


class IncidentOut(BaseModel):
    id: uuid.UUID
    local_id: str | None
    incident_number: str | None
    incident_type: str | None
    location_address: str | None
    location_lat: float | None
    location_lng: float | None
    alarm_time: datetime | None
    dispatch_time: datetime | None
    en_route_time: datetime | None
    on_scene_time: datetime | None
    controlled_time: datetime | None
    cleared_time: datetime | None
    units_responding: list[str]
    personnel_on_scene: list[str]
    casualty_civilian: int
    casualty_ff: int
    narrative: str | None
    actions_taken: list[str]
    property_use: str | None
    raw_data: dict[str, Any]
    sync_status: str
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaxonomyOption(BaseModel):
    value: str
    label: str


class IncidentTaxonomyResponse(BaseModel):
    incident_types: list[TaxonomyOption]
    action_taken_codes: list[TaxonomyOption]
    property_use_codes: list[TaxonomyOption]
