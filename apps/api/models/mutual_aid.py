import uuid
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin, UUIDPKMixin


class MutualAidAgency(Base, UUIDPKMixin, TimestampMixin):
    """An external agency available for mutual aid."""

    __tablename__ = "mutual_aid_agencies"

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    # e.g. "fire", "ems", "law_enforcement", "hazmat", "rescue"
    agency_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    radio_channel: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class MutualAidAssignment(Base, UUIDPKMixin, TimestampMixin):
    """A mutual aid agency assigned to an active incident."""

    __tablename__ = "mutual_aid_assignments"

    incident_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )
    agency_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mutual_aid_agencies.id", ondelete="SET NULL"),
        nullable=True,
    )
    # For ad-hoc mutual aid (agency not in directory)
    agency_name_override: Mapped[str | None] = mapped_column(String(256), nullable=True)
    units_assigned: Mapped[str | None] = mapped_column(String(512), nullable=True)  # comma-separated
    # "requested" | "en_route" | "on_scene" | "released"
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="requested")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
