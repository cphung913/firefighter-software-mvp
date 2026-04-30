import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin, UUIDPKMixin


class Apparatus(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "apparatus"
    __table_args__ = (
        UniqueConstraint("department_id", "local_id", name="uq_apparatus_dept_local"),
    )

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )
    local_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    unit_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    make: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vin: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # available | responding | out_of_service
    service_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="available"
    )
    mileage: Mapped[int | None] = mapped_column(Integer, nullable=True)
