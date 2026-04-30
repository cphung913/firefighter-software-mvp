import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class VoiceSessionOut(BaseModel):
    id: uuid.UUID
    session_code: str
    started_at: datetime
    ended_at: datetime | None
    sync_status: str
    extraction_status: str = "pending"
    extracted_fields: dict[str, Any] | None = None


class VoiceLogOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    recorded_by: uuid.UUID | None
    entry_type: str | None
    audio_ref: str | None
    raw_transcript: str | None
    ai_extracted: dict[str, Any] | None = None
    review_status: str
    sync_status: str
    created_at: datetime


class ExtractionField(BaseModel):
    value: Any | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class ExtractionResult(BaseModel):
    """NERIS fields extracted by AI — null means uncertain, not guessed."""
    incident_type: ExtractionField = Field(default_factory=ExtractionField)
    location_address: ExtractionField = Field(default_factory=ExtractionField)
    alarm_time: ExtractionField = Field(default_factory=ExtractionField)
    dispatch_time: ExtractionField = Field(default_factory=ExtractionField)
    en_route_time: ExtractionField = Field(default_factory=ExtractionField)
    on_scene_time: ExtractionField = Field(default_factory=ExtractionField)
    controlled_time: ExtractionField = Field(default_factory=ExtractionField)
    cleared_time: ExtractionField = Field(default_factory=ExtractionField)
    units_responding: ExtractionField = Field(default_factory=ExtractionField)
    personnel_on_scene: ExtractionField = Field(default_factory=ExtractionField)
    casualty_civilian: ExtractionField = Field(default_factory=ExtractionField)
    casualty_ff: ExtractionField = Field(default_factory=ExtractionField)
    actions_taken: ExtractionField = Field(default_factory=ExtractionField)
    property_use: ExtractionField = Field(default_factory=ExtractionField)
    narrative: ExtractionField = Field(default_factory=ExtractionField)

    model_config = {"extra": "ignore"}


class ExtractionOut(BaseModel):
    voice_log_id: uuid.UUID
    session_id: uuid.UUID
    review_status: str
    fields: ExtractionResult


class VoiceReviewQueueItem(BaseModel):
    voice_log_id: uuid.UUID
    session_id: uuid.UUID
    created_at: datetime
    review_status: str


class VoiceReviewQueueOut(BaseModel):
    count: int
    items: list[VoiceReviewQueueItem]
