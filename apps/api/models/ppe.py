import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin, UUIDPKMixin


class PpeItem(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "ppe_items"
    __table_args__ = (
        UniqueConstraint("department_id", "local_id", name="uq_ppe_items_dept_local"),
    )

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )
    local_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    item_type: Mapped[str] = mapped_column(String(32), nullable=False)  # helmet, coat, ...
    serial_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    manufacture_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_inspection: Mapped[date | None] = mapped_column(Date, nullable=True)
    retired_at: Mapped[date | None] = mapped_column(Date, nullable=True)
