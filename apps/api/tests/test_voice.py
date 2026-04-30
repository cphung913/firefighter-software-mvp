"""
Tests for the voice-sessions router (Stage 4).

Requires a running PostgreSQL instance (skipped otherwise).
Uses the same pattern as test_tenancy.py: real DB, real app, ephemeral fixtures.
"""

import io
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete, select, text
from sqlalchemy.exc import ProgrammingError, OperationalError

from core.db import AsyncSessionLocal
from core.security import create_access_token, hash_password
from main import app
from models.department import Department
from models.user import User
from models.voice_session import VoiceSession
from models.voice_log import VoiceLog


# ── helpers ───────────────────────────────────────────────────────────────────

async def _db_available(session) -> bool:
    """Returns False if DB is unreachable or schema is stale (migrations not run)."""
    try:
        await session.execute(text("select 1"))
        await session.execute(text("select incident_seq from departments limit 0"))
        return True
    except Exception:
        return False


async def _purge_email(session, email: str) -> None:
    """Delete any leftover user+dept rows for this email (from aborted prior runs)."""
    existing = await session.scalar(select(User).where(User.email == email))
    if existing:
        await session.execute(
            delete(VoiceLog).where(VoiceLog.department_id == existing.department_id)
        )
        await session.execute(
            delete(VoiceSession).where(VoiceSession.department_id == existing.department_id)
        )
        await session.execute(delete(User).where(User.id == existing.id))
        await session.execute(
            delete(Department).where(Department.id == existing.department_id)
        )
        await session.flush()


async def _make_dept_and_user(session, dept_name: str, user_email: str):
    await _purge_email(session, user_email)

    dept = Department(name=dept_name)
    session.add(dept)
    await session.flush()

    user = User(
        department_id=dept.id,
        name=user_email.split("@")[0],
        email=user_email,
        password_hash=hash_password("s3cr3t"),
        role="admin",
    )
    session.add(user)
    await session.flush()
    return dept, user


def _token(user: User, dept: Department) -> str:
    return create_access_token(
        subject=str(user.id),
        claims={"dept": str(dept.id), "role": user.role},
    )


async def _cleanup(dept_ids: list, user_ids: list) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(
            delete(VoiceLog).where(VoiceLog.department_id.in_(dept_ids))
        )
        await session.execute(
            delete(VoiceSession).where(VoiceSession.department_id.in_(dept_ids))
        )
        await session.execute(delete(User).where(User.id.in_(user_ids)))
        await session.execute(delete(Department).where(Department.id.in_(dept_ids)))
        await session.commit()


# ── tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_session_returns_code() -> None:
    async with AsyncSessionLocal() as session:
        if not await _db_available(session):
            pytest.skip("Database unavailable")
        dept, user = await _make_dept_and_user(session, "VFD Stage4 Create", "create@voice.test")
        await session.commit()
        dept_id, user_id = dept.id, user.id

    try:
        token = _token(user, dept)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/voice-sessions",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert resp.status_code == 201
        body = resp.json()
        code = body["session_code"]
        assert len(code) == 6
        for bad in ("O", "0", "I", "1"):
            assert bad not in code, f"Code {code!r} contains forbidden char {bad!r}"
        assert body["ended_at"] is None
    finally:
        await _cleanup([dept_id], [user_id])


@pytest.mark.asyncio
async def test_join_session_by_code() -> None:
    async with AsyncSessionLocal() as session:
        if not await _db_available(session):
            pytest.skip("Database unavailable")
        dept, user = await _make_dept_and_user(session, "VFD Stage4 Join", "join@voice.test")
        await session.commit()
        dept_id, user_id = dept.id, user.id

    try:
        token = _token(user, dept)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            create_resp = await client.post(
                "/api/v1/voice-sessions",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert create_resp.status_code == 201
            code = create_resp.json()["session_code"]

            join_resp = await client.get(
                f"/api/v1/voice-sessions/join/{code}",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert join_resp.status_code == 200
            assert join_resp.json()["session_code"] == code
    finally:
        await _cleanup([dept_id], [user_id])


@pytest.mark.asyncio
async def test_end_session() -> None:
    async with AsyncSessionLocal() as session:
        if not await _db_available(session):
            pytest.skip("Database unavailable")
        dept, user = await _make_dept_and_user(session, "VFD Stage4 End", "end@voice.test")
        await session.commit()
        dept_id, user_id = dept.id, user.id

    try:
        token = _token(user, dept)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            create_resp = await client.post(
                "/api/v1/voice-sessions",
                headers={"Authorization": f"Bearer {token}"},
            )
            session_id = create_resp.json()["id"]

            end_resp = await client.post(
                f"/api/v1/voice-sessions/{session_id}/end",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert end_resp.status_code == 200
            assert end_resp.json()["ended_at"] is not None

            # Idempotent
            end2 = await client.post(
                f"/api/v1/voice-sessions/{session_id}/end",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert end2.status_code == 200
    finally:
        await _cleanup([dept_id], [user_id])


@pytest.mark.asyncio
async def test_upload_clip_and_list_logs() -> None:
    async with AsyncSessionLocal() as session:
        if not await _db_available(session):
            pytest.skip("Database unavailable")
        dept, user = await _make_dept_and_user(session, "VFD Stage4 Logs", "logs@voice.test")
        await session.commit()
        dept_id, user_id = dept.id, user.id

    try:
        token = _token(user, dept)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            create_resp = await client.post(
                "/api/v1/voice-sessions",
                headers={"Authorization": f"Bearer {token}"},
            )
            session_id = create_resp.json()["id"]

            fake_audio = io.BytesIO(b"RIFF" + b"\x00" * 40)
            upload_resp = await client.post(
                f"/api/v1/voice-sessions/{session_id}/logs",
                headers={"Authorization": f"Bearer {token}"},
                files={"audio": ("clip.webm", fake_audio, "audio/webm")},
                data={"raw_transcript": "Engine 3 on scene", "entry_type": "narrative"},
            )
            assert upload_resp.status_code == 201
            log_body = upload_resp.json()
            assert log_body["raw_transcript"] == "Engine 3 on scene"
            assert log_body["entry_type"] == "narrative"

            list_resp = await client.get(
                f"/api/v1/voice-sessions/{session_id}/logs",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert list_resp.status_code == 200
            logs = list_resp.json()
            assert len(logs) == 1
            assert logs[0]["id"] == log_body["id"]
    finally:
        await _cleanup([dept_id], [user_id])


@pytest.mark.asyncio
async def test_cross_department_isolation() -> None:
    """Dept B user cannot join or end Dept A's session."""
    async with AsyncSessionLocal() as session:
        if not await _db_available(session):
            pytest.skip("Database unavailable")
        dept_a, user_a = await _make_dept_and_user(session, "VFD Isolation A", "a@iso.test")
        dept_b, user_b = await _make_dept_and_user(session, "VFD Isolation B", "b@iso.test")
        await session.commit()
        dept_a_id, dept_b_id = dept_a.id, dept_b.id
        user_a_id, user_b_id = user_a.id, user_b.id

    try:
        token_a = _token(user_a, dept_a)
        token_b = _token(user_b, dept_b)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            create_resp = await client.post(
                "/api/v1/voice-sessions",
                headers={"Authorization": f"Bearer {token_a}"},
            )
            session_id = create_resp.json()["id"]
            code = create_resp.json()["session_code"]

            join_resp = await client.get(
                f"/api/v1/voice-sessions/join/{code}",
                headers={"Authorization": f"Bearer {token_b}"},
            )
            assert join_resp.status_code == 404

            end_resp = await client.post(
                f"/api/v1/voice-sessions/{session_id}/end",
                headers={"Authorization": f"Bearer {token_b}"},
            )
            assert end_resp.status_code == 404
    finally:
        await _cleanup([dept_a_id, dept_b_id], [user_a_id, user_b_id])


@pytest.mark.asyncio
async def test_join_nonexistent_code_404() -> None:
    async with AsyncSessionLocal() as session:
        if not await _db_available(session):
            pytest.skip("Database unavailable")
        dept, user = await _make_dept_and_user(session, "VFD Stage4 404", "miss@voice.test")
        await session.commit()
        dept_id, user_id = dept.id, user.id

    try:
        token = _token(user, dept)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/api/v1/voice-sessions/join/XXXXXX",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 404
    finally:
        await _cleanup([dept_id], [user_id])
