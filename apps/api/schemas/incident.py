from datetime import datetime
from typing import Any

from pydantic import BaseModel

from schemas.assets import ApparatusOut


class IncidentRosterUserOut(BaseModel):
    id: str
    name: str
    role: str
    badge_number: str | None


class IncidentBootstrapResponse(BaseModel):
    apparatus: list[ApparatusOut]
    users: list[IncidentRosterUserOut]


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
