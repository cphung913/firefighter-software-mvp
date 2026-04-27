import uuid
from datetime import datetime

from pydantic import BaseModel


class ChecklistTemplateItemOut(BaseModel):
    id: str
    label: str
    description: str | None = None


class ChecklistTemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    items: list[ChecklistTemplateItemOut]
    updated_at: datetime


class ChecklistApparatusOut(BaseModel):
    id: uuid.UUID
    local_id: str | None
    unit_id: str | None
    type: str | None
    year: int | None
    make: str | None
    model: str | None
    vin: str | None
    mileage: int | None
    service_status: str


class ChecklistBootstrapResponse(BaseModel):
    templates: list[ChecklistTemplateOut]
    apparatus: list[ChecklistApparatusOut]
