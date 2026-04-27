import uuid
from datetime import date

from pydantic import BaseModel

from schemas.checklist import ChecklistApparatusOut
from schemas.incident import IncidentRosterUserOut


class AssetPpeItemOut(BaseModel):
    id: uuid.UUID
    local_id: str | None
    item_type: str
    serial_number: str | None
    assigned_to: uuid.UUID | None
    manufacture_date: date | None
    purchase_date: date | None
    last_inspection: date | None
    retired_at: date | None


class AssetScbaUnitOut(BaseModel):
    id: uuid.UUID
    local_id: str | None
    serial_number: str | None
    manufacturer: str | None
    assigned_to: uuid.UUID | None
    cylinder_hydro_date: date | None
    regulator_service_date: date | None


class AssetBootstrapResponse(BaseModel):
    apparatus: list[ChecklistApparatusOut]
    ppe_items: list[AssetPpeItemOut]
    scba_units: list[AssetScbaUnitOut]
    users: list[IncidentRosterUserOut]
