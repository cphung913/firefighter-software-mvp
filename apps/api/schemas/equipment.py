import uuid
from datetime import date

from pydantic import BaseModel


class EquipmentOut(BaseModel):
    id: uuid.UUID
    local_id: str | None
    equipment_type: str
    identifier: str | None
    name: str | None
    manufacturer: str | None
    model: str | None
    year_manufactured: int | None
    assigned_apparatus_id: uuid.UUID | None
    status: str
    purchase_date: date | None
    notes: str | None
    raw_data: dict | None
    next_inspection_due: date | None
    last_inspection_date: date | None


class EquipmentCreateRequest(BaseModel):
    local_id: str | None = None
    equipment_type: str = "other"
    identifier: str | None = None
    name: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    year_manufactured: int | None = None
    assigned_apparatus_id: uuid.UUID | None = None
    status: str = "in_service"
    purchase_date: date | None = None
    notes: str | None = None
    raw_data: dict | None = None


class EquipmentUpdateRequest(BaseModel):
    equipment_type: str | None = None
    identifier: str | None = None
    name: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    year_manufactured: int | None = None
    assigned_apparatus_id: uuid.UUID | None = None
    status: str | None = None
    purchase_date: date | None = None
    notes: str | None = None
    raw_data: dict | None = None


class EquipmentInspectionOut(BaseModel):
    id: uuid.UUID
    local_id: str | None
    equipment_id: uuid.UUID | None
    equipment_local_id: str | None
    inspection_type: str | None
    inspection_date: date | None
    passed: bool
    inspector_name: str | None
    notes: str | None
    next_due: date | None
    raw_data: dict | None


class EquipmentInspectionCreateRequest(BaseModel):
    local_id: str | None = None
    equipment_local_id: str | None = None
    inspection_type: str | None = None
    inspection_date: date | None = None
    passed: bool = True
    inspector_name: str | None = None
    notes: str | None = None
    next_due: date | None = None
    raw_data: dict | None = None


class EquipmentMaintenanceOut(BaseModel):
    id: uuid.UUID
    local_id: str | None
    equipment_id: uuid.UUID | None
    equipment_local_id: str | None
    maintenance_type: str | None
    maintenance_date: date | None
    performed_by: str | None
    cost: float | None
    description: str | None
    out_of_service_start: date | None
    out_of_service_end: date | None


class EquipmentMaintenanceCreateRequest(BaseModel):
    local_id: str | None = None
    equipment_local_id: str | None = None
    maintenance_type: str | None = None
    maintenance_date: date | None = None
    performed_by: str | None = None
    cost: float | None = None
    description: str | None = None
    out_of_service_start: date | None = None
    out_of_service_end: date | None = None
