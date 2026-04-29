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


class ApparatusCreateRequest(BaseModel):
    local_id: str | None = None
    unit_id: str | None = None
    type: str | None = None
    year: int | None = None
    make: str | None = None
    model: str | None = None
    vin: str | None = None
    mileage: int | None = None
    service_status: str | None = None


class ApparatusStatusUpdate(BaseModel):
    service_status: str
