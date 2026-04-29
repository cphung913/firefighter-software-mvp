import random
import string
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_user
from models.user import User
from models.voice_log import VoiceLog
from models.voice_session import VoiceSession
from schemas.voice import VoiceLogOut, VoiceSessionOut

router = APIRouter(prefix="/voice-sessions", tags=["voice"])

_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no O/0/I/1


def _gen_code() -> str:
    return "".join(random.choices(_CODE_CHARS, k=6))


@router.post("", response_model=VoiceSessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VoiceSessionOut:
    for _ in range(5):
        code = _gen_code()
        existing = await db.scalar(
            select(VoiceSession).where(
                VoiceSession.session_code == code,
                VoiceSession.ended_at.is_(None),
            )
        )
        if existing is None:
            break
    else:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="code collision")

    session = VoiceSession(
        department_id=user.department_id,
        session_code=code,
        started_by=user.id,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return VoiceSessionOut.model_validate(session, from_attributes=True)


@router.get("/join/{code}", response_model=VoiceSessionOut)
async def join_session(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VoiceSessionOut:
    session = await db.scalar(
        select(VoiceSession).where(
            VoiceSession.session_code == code.upper(),
            VoiceSession.department_id == user.department_id,
            VoiceSession.ended_at.is_(None),
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")
    return VoiceSessionOut.model_validate(session, from_attributes=True)


@router.get("/{session_id}", response_model=VoiceSessionOut)
async def get_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VoiceSessionOut:
    session = await db.scalar(
        select(VoiceSession).where(
            VoiceSession.id == session_id,
            VoiceSession.department_id == user.department_id,
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")
    return VoiceSessionOut.model_validate(session, from_attributes=True)


@router.post("/{session_id}/end", response_model=VoiceSessionOut)
async def end_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VoiceSessionOut:
    session = await db.scalar(
        select(VoiceSession).where(
            VoiceSession.id == session_id,
            VoiceSession.department_id == user.department_id,
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")
    if session.ended_at is not None:
        return VoiceSessionOut.model_validate(session, from_attributes=True)
    session.ended_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return VoiceSessionOut.model_validate(session, from_attributes=True)


@router.get("/{session_id}/logs", response_model=list[VoiceLogOut])
async def list_logs(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[VoiceLogOut]:
    session = await db.scalar(
        select(VoiceSession).where(
            VoiceSession.id == session_id,
            VoiceSession.department_id == user.department_id,
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")

    logs = await db.scalars(
        select(VoiceLog)
        .where(VoiceLog.session_id == session_id)
        .order_by(VoiceLog.created_at)
    )
    return [VoiceLogOut.model_validate(l, from_attributes=True) for l in logs]


@router.post("/{session_id}/logs", response_model=VoiceLogOut, status_code=status.HTTP_201_CREATED)
async def upload_clip(
    session_id: uuid.UUID,
    audio: UploadFile = File(...),
    recorded_by_id: str | None = Form(default=None),
    raw_transcript: str | None = Form(default=None),
    entry_type: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VoiceLogOut:
    session = await db.scalar(
        select(VoiceSession).where(
            VoiceSession.id == session_id,
            VoiceSession.department_id == user.department_id,
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")

    # Store audio_ref as a placeholder path. In production this would go to object storage.
    audio_ref = f"voice/{session_id}/{uuid.uuid4()}.webm"

    attributed_to: uuid.UUID | None = user.id
    if recorded_by_id:
        try:
            attributed_to = uuid.UUID(recorded_by_id)
        except ValueError:
            pass

    log = VoiceLog(
        department_id=user.department_id,
        session_id=session_id,
        recorded_by=attributed_to,
        entry_type=entry_type or "narrative",
        audio_ref=audio_ref,
        raw_transcript=raw_transcript,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return VoiceLogOut.model_validate(log, from_attributes=True)
