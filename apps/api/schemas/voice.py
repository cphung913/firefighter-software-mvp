import uuid
from datetime import datetime

from pydantic import BaseModel


class VoiceSessionOut(BaseModel):
    id: uuid.UUID
    session_code: str
    started_at: datetime
    ended_at: datetime | None
    sync_status: str


class VoiceLogOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    recorded_by: uuid.UUID | None
    entry_type: str | None
    audio_ref: str | None
    raw_transcript: str | None
    review_status: str
    sync_status: str
    created_at: datetime
