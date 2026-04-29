import uuid

from pydantic import BaseModel


class ApparatusOut(BaseModel):
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


class ApparatusStatusUpdate(BaseModel):
    service_status: str
