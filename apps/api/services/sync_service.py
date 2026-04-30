"""Table-agnostic sync engine.

Each entity table that participates in sync must:
  * Have a `department_id` UUID column.
  * Have a `local_id` column (nullable string) unique within (department_id, local_id).
  * Have an `updated_at` (timezone-aware) column managed by the ORM.

Conflict policy for MVP: last-write-wins by `updated_at`. A conflict is flagged only when
the server record is strictly newer than the client mutation.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import Date, DateTime, and_, select
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession

from models.apparatus import Apparatus
from models.base import Base
from models.incident import Incident
from models.sync_record import SyncRecord
from models.voice_log import VoiceLog
from schemas.sync import (
    SyncConflict,
    SyncMutation,
    SyncPullChange,
    SyncPushResponse,
    SyncedRef,
    SyncTable,
)

TABLE_REGISTRY: dict[str, type[Base]] = {
    "incidents": Incident,
    "apparatus": Apparatus,
    "voice_logs": VoiceLog,
}

PROTECTED_FIELDS = {
    "id",
    "local_id",
    "department_id",
    "created_at",
    "updated_at",
    "_sync_status",
    "_dirty_fields",
    "server_id",
}


def _serialize(model: Base) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for column in model.__table__.columns:  # type: ignore[attr-defined]
        value = getattr(model, column.name)
        if isinstance(value, datetime):
            value = value.isoformat()
        elif isinstance(value, date):
            value = value.isoformat()
        elif isinstance(value, uuid.UUID):
            value = str(value)
        out[column.name] = value
    return out


def _coerce_value(column_type: Any, value: Any) -> Any:
    if value is None:
        return None
    if isinstance(column_type, DateTime) and isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    if isinstance(column_type, Date) and isinstance(value, str):
        return date.fromisoformat(value)
    if isinstance(column_type, PG_UUID) and isinstance(value, str):
        return uuid.UUID(value)
    return value


def _filter_assignable(model_cls: type[Base], data: dict[str, Any]) -> dict[str, Any]:
    columns = {c.name: c for c in model_cls.__table__.columns}  # type: ignore[attr-defined]
    out: dict[str, Any] = {}
    for key, value in data.items():
        if key not in columns or key in PROTECTED_FIELDS:
            continue
        out[key] = _coerce_value(columns[key].type, value)
    return out


async def apply_push(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    user_id: uuid.UUID,
    mutations: list[SyncMutation],
) -> SyncPushResponse:
    synced: list[SyncedRef] = []
    conflicts: list[SyncConflict] = []

    for mutation in mutations:
        model_cls = TABLE_REGISTRY.get(mutation.table)
        if model_cls is None:
            continue

        existing = await db.scalar(
            select(model_cls).where(
                and_(
                    model_cls.department_id == department_id,  # type: ignore[attr-defined]
                    model_cls.local_id == mutation.local_id,  # type: ignore[attr-defined]
                )
            )
        )

        if mutation.operation == "delete":
            if existing is not None:
                await db.delete(existing)
                db.add(
                    SyncRecord(
                        department_id=department_id,
                        table_name=mutation.table,
                        record_id=existing.id,  # type: ignore[attr-defined]
                        local_id=mutation.local_id,
                        last_modified_by=user_id,
                        is_deleted=True,
                    )
                )
            synced.append(
                SyncedRef(
                    table=mutation.table,
                    local_id=mutation.local_id,
                    server_id=existing.id if existing else uuid.uuid4(),  # type: ignore[attr-defined]
                    updated_at=datetime.now(timezone.utc),
                )
            )
            continue

        clean = _filter_assignable(model_cls, mutation.data)
        if mutation.table == "incidents" and "created_by" not in clean:
            clean["created_by"] = user_id
        if mutation.table == "voice_logs" and "recorded_by" not in clean:
            clean["recorded_by"] = user_id

        if existing is None:
            new_obj = model_cls(  # type: ignore[call-arg]
                department_id=department_id,
                local_id=mutation.local_id,
                **clean,
            )
            db.add(new_obj)
            await db.flush()
            db.add(
                SyncRecord(
                    department_id=department_id,
                    table_name=mutation.table,
                    record_id=new_obj.id,  # type: ignore[attr-defined]
                    local_id=mutation.local_id,
                    last_modified_by=user_id,
                )
            )
            synced.append(
                SyncedRef(
                    table=mutation.table,
                    local_id=mutation.local_id,
                    server_id=new_obj.id,  # type: ignore[attr-defined]
                    updated_at=new_obj.updated_at,  # type: ignore[attr-defined]
                )
            )
            continue

        server_updated: datetime = existing.updated_at  # type: ignore[attr-defined]
        if server_updated.tzinfo is None:
            server_updated = server_updated.replace(tzinfo=timezone.utc)
        client_updated = mutation.updated_at
        if client_updated.tzinfo is None:
            client_updated = client_updated.replace(tzinfo=timezone.utc)

        if server_updated > client_updated:
            conflicts.append(
                SyncConflict(
                    table=mutation.table,
                    local_id=mutation.local_id,
                    reason="server_newer",
                    server_record=_serialize(existing),
                    client_record=mutation.data,
                )
            )
            continue

        for k, v in clean.items():
            setattr(existing, k, v)
        await db.flush()
        db.add(
            SyncRecord(
                department_id=department_id,
                table_name=mutation.table,
                record_id=existing.id,  # type: ignore[attr-defined]
                local_id=mutation.local_id,
                last_modified_by=user_id,
            )
        )
        synced.append(
            SyncedRef(
                table=mutation.table,
                local_id=mutation.local_id,
                server_id=existing.id,  # type: ignore[attr-defined]
                updated_at=existing.updated_at,  # type: ignore[attr-defined]
            )
        )

    await db.commit()
    return SyncPushResponse(
        synced=synced,
        conflicts=conflicts,
        server_time=datetime.now(timezone.utc),
    )


async def collect_pull(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    since: datetime | None,
    tables: list[SyncTable] | None = None,
) -> list[SyncPullChange]:
    target_tables = list(TABLE_REGISTRY.keys()) if tables is None else list(tables)
    changes: list[SyncPullChange] = []

    for table_name in target_tables:
        model_cls = TABLE_REGISTRY[table_name]
        stmt = select(model_cls).where(model_cls.department_id == department_id)  # type: ignore[attr-defined]
        if since is not None:
            stmt = stmt.where(model_cls.updated_at > since)  # type: ignore[attr-defined]
        rows = (await db.scalars(stmt)).all()
        for row in rows:
            changes.append(
                SyncPullChange(
                    table=table_name,  # type: ignore[arg-type]
                    record_id=row.id,  # type: ignore[attr-defined]
                    data=_serialize(row),
                    updated_at=row.updated_at,  # type: ignore[attr-defined]
                    is_deleted=False,
                )
            )

    return changes
