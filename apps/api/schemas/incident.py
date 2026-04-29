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
