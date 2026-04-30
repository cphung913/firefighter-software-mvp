from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.apparatus import Apparatus
from models.user import User
from models.voice_log import VoiceLog
from models.voice_session import VoiceSession
from services.extraction_service import extract_neris_fields
from schemas.voice import ExtractionResult


async def gather_extraction_context(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    session_id: uuid.UUID,
) -> tuple[list[str], list[str], list[str]]:
    logs = await db.scalars(
        select(VoiceLog)
        .where(
            VoiceLog.department_id == department_id,
            VoiceLog.session_id == session_id,
            VoiceLog.raw_transcript.isnot(None),
        )
        .order_by(VoiceLog.created_at)
    )
    transcripts = [row.raw_transcript for row in logs if row.raw_transcript]

    roster_rows = await db.scalars(
        select(User)
        .where(User.department_id == department_id)
        .order_by(User.name)
    )
    roster = [row.name for row in roster_rows]

    apparatus_rows = await db.scalars(
        select(Apparatus)
        .where(Apparatus.department_id == department_id)
        .order_by(Apparatus.unit_id)
    )
    apparatus = [row.unit_id for row in apparatus_rows if row.unit_id]

    return transcripts, roster, apparatus


async def run_extraction(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    session_id: uuid.UUID,
    gps: str | None = None,
) -> Any:
    transcripts, roster, apparatus = await gather_extraction_context(
        db,
        department_id=department_id,
        session_id=session_id,
    )
    return await extract_neris_fields(
        transcripts=transcripts,
        gps=gps,
        roster=roster,
        apparatus=apparatus,
    )


async def apply_extraction(
    db: AsyncSession,
    *,
    log: VoiceLog,
    session: VoiceSession | None,
    department_id: uuid.UUID,
    gps: str | None = None,
) -> ExtractionResult:
    log.review_status = "extracting"
    if session is not None:
        session.extraction_status = "extracting"
    await db.commit()

    fields = await run_extraction(
        db,
        department_id=department_id,
        session_id=log.session_id,
        gps=gps,
    )

    log.ai_extracted = fields.model_dump()
    log.review_status = "pending"
    if session is not None:
        session.extraction_status = "done"
        session.extracted_fields = fields.model_dump()

    await db.commit()
    return fields
