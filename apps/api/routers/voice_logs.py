import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, get_current_user
from models.department import Department
from models.user import User
from models.voice_log import VoiceLog
from models.voice_session import VoiceSession
from schemas.voice import ExtractionOut, ExtractionResult, VoiceLogOut, VoiceReviewQueueItem, VoiceReviewQueueOut
from services.voice_review_service import apply_extraction

router = APIRouter(prefix="/voice-logs", tags=["voice"])


def _coerce_fields(raw: dict | None) -> ExtractionResult:
    if raw is None:
        return ExtractionResult()
    try:
        return ExtractionResult.model_validate(raw)
    except Exception:
        return ExtractionResult()


@router.get("/{log_id}", response_model=VoiceLogOut)
async def get_voice_log(
    log_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> VoiceLogOut:
    log = await db.scalar(
        select(VoiceLog).where(
            VoiceLog.id == log_id,
            VoiceLog.department_id == department.id,
        )
    )
    if log is None:
        raise HTTPException(status_code=404, detail="voice log not found")
    return VoiceLogOut.model_validate(log, from_attributes=True)


@router.get("/pending-review", response_model=VoiceReviewQueueOut)
async def pending_review_queue(
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> VoiceReviewQueueOut:
    rows = await db.scalars(
        select(VoiceLog)
        .where(
            VoiceLog.department_id == department.id,
            VoiceLog.review_status == "pending",
            VoiceLog.ai_extracted.isnot(None),
        )
        .order_by(desc(VoiceLog.created_at))
        .limit(20)
    )
    items = [
        VoiceReviewQueueItem(
            voice_log_id=row.id,
            session_id=row.session_id,
            created_at=row.created_at,
            review_status=row.review_status,
        )
        for row in rows
    ]
    return VoiceReviewQueueOut(count=len(items), items=items)


@router.post("/{log_id}/extract", response_model=ExtractionOut)
async def extract_voice_log(
    log_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> ExtractionOut:
    log = await db.scalar(
        select(VoiceLog).where(
            VoiceLog.id == log_id,
            VoiceLog.department_id == department.id,
        )
    )
    if log is None:
        raise HTTPException(status_code=404, detail="voice log not found")

    session = await db.scalar(
        select(VoiceSession).where(
            VoiceSession.id == log.session_id,
            VoiceSession.department_id == department.id,
        )
    )

    if log.review_status == "extracting":
        return ExtractionOut(
            voice_log_id=log.id,
            session_id=log.session_id,
            review_status=log.review_status,
            fields=_coerce_fields(log.ai_extracted),
        )

    try:
        fields = await apply_extraction(
            db,
            log=log,
            session=session,
            department_id=department.id,
        )
    except Exception as exc:
        log.review_status = "failed"
        if session is not None:
            session.extraction_status = "failed"
        await db.commit()
        raise HTTPException(
            status_code=502,
            detail="AI extraction failed — transcripts saved, try again",
        ) from exc

    return ExtractionOut(
        voice_log_id=log.id,
        session_id=log.session_id,
        review_status=log.review_status,
        fields=fields,
    )


@router.post("/{log_id}/approve", response_model=ExtractionOut)
async def approve_voice_log(
    log_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> ExtractionOut:
    log = await db.scalar(
        select(VoiceLog).where(
            VoiceLog.id == log_id,
            VoiceLog.department_id == department.id,
        )
    )
    if log is None:
        raise HTTPException(status_code=404, detail="voice log not found")

    log.review_status = "approved"
    await db.commit()

    return ExtractionOut(
        voice_log_id=log.id,
        session_id=log.session_id,
        review_status=log.review_status,
        fields=_coerce_fields(log.ai_extracted),
    )
