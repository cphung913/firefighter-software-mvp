import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin, UUIDPKMixin


class ScbaUnit(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "scba_units"
    __table_args__ = (
        UniqueConstraint("department_id", "local_id", name="uq_scba_units_dept_local"),
    )

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )
    local_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    serial_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    manufacturer: Mapped[str | None] = mapped_column(String(64), nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    cylinder_hydro_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    regulator_service_date: Mapped[date | None] = mapped_column(Date, nullable=True)
