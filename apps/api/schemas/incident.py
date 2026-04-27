from pydantic import BaseModel

from schemas.checklist import ChecklistApparatusOut


class IncidentRosterUserOut(BaseModel):
    id: str
    name: str
    role: str
    badge_number: str | None


class IncidentBootstrapResponse(BaseModel):
    apparatus: list[ChecklistApparatusOut]
    users: list[IncidentRosterUserOut]
