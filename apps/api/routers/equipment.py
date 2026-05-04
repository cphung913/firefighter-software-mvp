import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, get_current_user, require_admin
from models.department import Department
from models.equipment import Equipment, EquipmentInspection, EquipmentMaintenance
from models.user import User
from schemas.equipment import (
    EquipmentCreateRequest,
    EquipmentInspectionCreateRequest,
    EquipmentInspectionOut,
    EquipmentMaintenanceCreateRequest,
    EquipmentMaintenanceOut,
    EquipmentOut,
    EquipmentUpdateRequest,
)

router = APIRouter(prefix="/assets/equipment", tags=["equipment"])

VALID_STATUSES = {"in_service", "out_of_service", "retired"}
VALID_TYPES = {"scba", "hose", "ladder", "ppe", "extinguisher", "tool", "other"}


# ── Equipment CRUD ──────────────────────────────────────────────────────────

@router.get("", response_model=list[EquipmentOut])
async def list_equipment(
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[EquipmentOut]:
    rows = (
        await db.scalars(
            select(Equipment)
            .where(Equipment.department_id == department.id)
            .order_by(Equipment.equipment_type, Equipment.name)
        )
    ).all()
    return [EquipmentOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    body: EquipmentCreateRequest,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> EquipmentOut:
    payload = body.model_dump(exclude_none=True)
    if payload.get("equipment_type", "other") not in VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"equipment_type must be one of {sorted(VALID_TYPES)}")
    if payload.get("status", "in_service") not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {sorted(VALID_STATUSES)}")
    item = Equipment(department_id=department.id, **payload)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return EquipmentOut.model_validate(item, from_attributes=True)


@router.patch("/{equipment_id}", response_model=EquipmentOut)
async def update_equipment(
    equipment_id: uuid.UUID,
    body: EquipmentUpdateRequest,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> EquipmentOut:
    item = await db.scalar(
        select(Equipment).where(
            Equipment.id == equipment_id,
            Equipment.department_id == department.id,
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Equipment not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return EquipmentOut.model_validate(item, from_attributes=True)


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment(
    equipment_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> None:
    item = await db.scalar(
        select(Equipment).where(
            Equipment.id == equipment_id,
            Equipment.department_id == department.id,
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Equipment not found")
    await db.delete(item)
    await db.commit()


# ── Inspections ─────────────────────────────────────────────────────────────

@router.get("/{equipment_id}/inspections", response_model=list[EquipmentInspectionOut])
async def list_inspections(
    equipment_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[EquipmentInspectionOut]:
    rows = (
        await db.scalars(
            select(EquipmentInspection)
            .where(
                EquipmentInspection.equipment_id == equipment_id,
                EquipmentInspection.department_id == department.id,
            )
            .order_by(EquipmentInspection.inspection_date.desc())
        )
    ).all()
    return [EquipmentInspectionOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/{equipment_id}/inspections", response_model=EquipmentInspectionOut, status_code=status.HTTP_201_CREATED)
async def log_inspection(
    equipment_id: uuid.UUID,
    body: EquipmentInspectionCreateRequest,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> EquipmentInspectionOut:
    item = await db.scalar(
        select(Equipment).where(
            Equipment.id == equipment_id,
            Equipment.department_id == department.id,
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Equipment not found")

    payload = body.model_dump(exclude_none=True)
    insp = EquipmentInspection(
        department_id=department.id,
        equipment_id=equipment_id,
        **payload,
    )
    db.add(insp)

    # Denormalize onto parent
    if body.inspection_date:
        item.last_inspection_date = body.inspection_date
    if body.next_due:
        item.next_inspection_due = body.next_due

    await db.commit()
    await db.refresh(insp)
    return EquipmentInspectionOut.model_validate(insp, from_attributes=True)


# ── Maintenance ──────────────────────────────────────────────────────────────

@router.get("/{equipment_id}/maintenance", response_model=list[EquipmentMaintenanceOut])
async def list_maintenance(
    equipment_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[EquipmentMaintenanceOut]:
    rows = (
        await db.scalars(
            select(EquipmentMaintenance)
            .where(
                EquipmentMaintenance.equipment_id == equipment_id,
                EquipmentMaintenance.department_id == department.id,
            )
            .order_by(EquipmentMaintenance.maintenance_date.desc())
        )
    ).all()
    return [EquipmentMaintenanceOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/{equipment_id}/maintenance", response_model=EquipmentMaintenanceOut, status_code=status.HTTP_201_CREATED)
async def log_maintenance(
    equipment_id: uuid.UUID,
    body: EquipmentMaintenanceCreateRequest,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> EquipmentMaintenanceOut:
    item = await db.scalar(
        select(Equipment).where(
            Equipment.id == equipment_id,
            Equipment.department_id == department.id,
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Equipment not found")

    payload = body.model_dump(exclude_none=True)
    maint = EquipmentMaintenance(
        department_id=department.id,
        equipment_id=equipment_id,
        **payload,
    )
    db.add(maint)
    await db.commit()
    await db.refresh(maint)
    return EquipmentMaintenanceOut.model_validate(maint, from_attributes=True)


# ── Compliance overview ──────────────────────────────────────────────────────

@router.get("/compliance", response_model=list[EquipmentOut])
async def compliance_overview(
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[EquipmentOut]:
    """Items with a next_inspection_due date, ordered soonest first."""
    rows = (
        await db.scalars(
            select(Equipment)
            .where(
                Equipment.department_id == department.id,
                Equipment.status == "in_service",
                Equipment.next_inspection_due.isnot(None),
            )
            .order_by(Equipment.next_inspection_due)
        )
    ).all()
    return [EquipmentOut.model_validate(r, from_attributes=True) for r in rows]
