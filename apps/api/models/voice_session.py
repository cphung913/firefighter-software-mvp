import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin, UUIDPKMixin


class VoiceSession(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "voice_sessions"

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 6 alphanumeric chars, no O/0/I/1 — displayed large for verbal handoff
    session_code: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    started_by: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    # pending | extracting | done | failed
    extraction_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    extracted_fields: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
