import uuid
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin, UUIDPKMixin


class VoiceLog(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "voice_logs"

    department_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("voice_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    entry_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    audio_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_extracted: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    # pending | approved | dismissed
    review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    sync_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
