import uuid

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin, UUIDPKMixin


class Equipment(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "equipment"
    __table_args__ = (
        UniqueConstraint("department_id", "local_id", name="uq_equipment_dept_local"),
    )

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )
    local_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # scba | hose | ladder | ppe | extinguisher | tool | other
    equipment_type: Mapped[str] = mapped_column(String(32), nullable=False, default="other")
    identifier: Mapped[str | None] = mapped_column(String(64), nullable=True)
    name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    manufacturer: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    year_manufactured: Mapped[int | None] = mapped_column(Integer, nullable=True)
    assigned_apparatus_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("apparatus.id", ondelete="SET NULL"),
        nullable=True,
    )
    # in_service | out_of_service | retired
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="in_service")
    purchase_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Denormalized: earliest upcoming inspection due date (any type)
    next_inspection_due: Mapped[str | None] = mapped_column(Date, nullable=True)
    last_inspection_date: Mapped[str | None] = mapped_column(Date, nullable=True)


class EquipmentInspection(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "equipment_inspections"
    __table_args__ = (
        UniqueConstraint("department_id", "local_id", name="uq_equip_insp_dept_local"),
    )

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )
    local_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    equipment_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("equipment.id", ondelete="CASCADE"),
        nullable=True,
    )
    # Stored so the server can resolve equipment_id when parent hasn't synced yet
    equipment_local_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # visual | annual | service_test | hydro_test | pre_use
    inspection_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    inspection_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    inspector_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_due: Mapped[str | None] = mapped_column(Date, nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class EquipmentMaintenance(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "equipment_maintenance"
    __table_args__ = (
        UniqueConstraint("department_id", "local_id", name="uq_equip_maint_dept_local"),
    )

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )
    local_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    equipment_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("equipment.id", ondelete="CASCADE"),
        nullable=True,
    )
    equipment_local_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # repair | service | replacement | hydro_test | retirement
    maintenance_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    maintenance_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    performed_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    cost: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    out_of_service_start: Mapped[str | None] = mapped_column(Date, nullable=True)
    out_of_service_end: Mapped[str | None] = mapped_column(Date, nullable=True)
