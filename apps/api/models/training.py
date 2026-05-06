import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin, UUIDPKMixin


class TrainingDrill(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "training_drills"

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # e.g. Live Fire, Hazmat, EMS, Truck Ops, Multi-Company, Pump Ops, Rescue
    drill_type: Mapped[str] = mapped_column(String(64), nullable=False, default="other")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    drill_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    hours: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=1.0)
    instructor: Mapped[str | None] = mapped_column(String(128), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # ISO training category code for compliance reporting
    iso_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class TrainingAttendee(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "training_attendees"
    __table_args__ = (
        UniqueConstraint("drill_id", "user_id", name="uq_training_attendee_drill_user"),
    )

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    drill_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("training_drills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class Certification(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "certifications"

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # EMT-B | EMT-P | CPR | Hazmat Ops | FF1 | FF2 | Driver/Operator | etc.
    cert_type: Mapped[str] = mapped_column(String(64), nullable=False)
    cert_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    issuing_body: Mapped[str | None] = mapped_column(String(128), nullable=True)
    issued_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # active | expired | renewed
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    document_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)
