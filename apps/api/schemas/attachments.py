import uuid
from datetime import datetime

from pydantic import BaseModel


class AttachmentOut(BaseModel):
    id: uuid.UUID
    incident_id: uuid.UUID
    department_id: uuid.UUID
    file_type: str
    original_filename: str | None
    file_ref: str
    mime_type: str | None
    file_size_bytes: int | None
    caption: str | None
    uploaded_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AttachmentUpdateRequest(BaseModel):
    caption: str | None = None
