import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin, UUIDPKMixin


class Incident(Base, UUIDPKMixin, TimestampMixin):
    """NERIS-aligned incident record. raw_data JSONB for forward-compat with FEMA changes."""

    __tablename__ = "incidents"
    __table_args__ = (
        UniqueConstraint("department_id", "local_id", name="uq_incidents_dept_local"),
        Index("ix_incidents_dept_alarm", "department_id", "alarm_time"),
    )

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )
    local_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    incident_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    incident_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    location_address: Mapped[str | None] = mapped_column(String(512), nullable=True)
    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    alarm_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispatch_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    en_route_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    on_scene_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    controlled_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cleared_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    units_responding: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    personnel_on_scene: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)

    casualty_civilian: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    casualty_ff: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    narrative: Mapped[str | None] = mapped_column(Text, nullable=True)
    actions_taken: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    property_use: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Never remove — FEMA field changes must not require migrations
    raw_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    sync_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
