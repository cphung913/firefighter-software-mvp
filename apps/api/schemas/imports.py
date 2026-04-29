from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ImportEntityType = Literal["apparatus", "personnel", "incidents"]
ImportRowAction = Literal["create", "update", "skip", "error"]


class ImportFieldMappingOut(BaseModel):
    source_header: str
    target_field: str | None
    confidence: float


class ImportSectionSummaryOut(BaseModel):
    dataset_label: str
    entity_type: ImportEntityType
    row_count: int
    mapped_fields: int
    warnings: list[str] = Field(default_factory=list)


class ImportUploadResponse(BaseModel):
    upload_id: str
    file_name: str
    sections: list[ImportSectionSummaryOut]


class ImportPreviewRequest(BaseModel):
    upload_id: str


class ImportRowDiffCellOut(BaseModel):
    current: Any | None = None
    incoming: Any | None = None


class ImportPreviewRowOut(BaseModel):
    row_index: int
    action: ImportRowAction
    match_reason: str | None = None
    warnings: list[str] = Field(default_factory=list)
    changed_fields: list[str] = Field(default_factory=list)
    incoming: dict[str, Any] = Field(default_factory=dict)
    current: dict[str, Any] | None = None
    diff: dict[str, ImportRowDiffCellOut] = Field(default_factory=dict)


class ImportPreviewSectionOut(BaseModel):
    dataset_label: str
    entity_type: ImportEntityType
    mappings: list[ImportFieldMappingOut]
    rows: list[ImportPreviewRowOut]
    warnings: list[str] = Field(default_factory=list)


class ImportPreviewResponse(BaseModel):
    upload_id: str
    file_name: str
    sections: list[ImportPreviewSectionOut]


class ImportCommitRequest(BaseModel):
    upload_id: str


class ImportCommitSummaryOut(BaseModel):
    entity_type: ImportEntityType
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: int = 0


class ImportCommitResponse(BaseModel):
    upload_id: str
    file_name: str
    summaries: list[ImportCommitSummaryOut]
    committed_at: datetime
