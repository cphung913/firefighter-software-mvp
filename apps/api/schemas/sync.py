import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

SyncTable = Literal[
    "incidents",
    "checklist_completions",
    "apparatus",
    "ppe_items",
    "scba_units",
]


class SyncMutation(BaseModel):
    table: SyncTable
    local_id: str
    operation: Literal["upsert", "delete"]
    data: dict[str, Any] = Field(default_factory=dict)
    updated_at: datetime
    client_timestamp: datetime


class SyncPushRequest(BaseModel):
    mutations: list[SyncMutation]


class SyncedRef(BaseModel):
    table: SyncTable
    local_id: str
    server_id: uuid.UUID
    updated_at: datetime


class SyncConflict(BaseModel):
    table: SyncTable
    local_id: str
    reason: str
    server_record: dict[str, Any]
    client_record: dict[str, Any]


class SyncPushResponse(BaseModel):
    synced: list[SyncedRef]
    conflicts: list[SyncConflict]
    server_time: datetime


class SyncPullChange(BaseModel):
    table: SyncTable
    record_id: uuid.UUID
    data: dict[str, Any]
    updated_at: datetime
    is_deleted: bool = False


class SyncPullResponse(BaseModel):
    changes: list[SyncPullChange]
    server_time: datetime
