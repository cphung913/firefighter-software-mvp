import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete, select, text

from core.db import AsyncSessionLocal
from core.security import create_access_token, hash_password
from main import app
from models.apparatus import Apparatus
from models.department import Department
from models.user import User


async def _purge_email(session, email: str) -> None:
    existing = await session.scalar(select(User).where(User.email == email))
    if existing:
        await session.execute(
            delete(Apparatus).where(Apparatus.department_id == existing.department_id)
        )
        await session.execute(delete(User).where(User.id == existing.id))
        await session.execute(
            delete(Department).where(Department.id == existing.department_id)
        )
        await session.flush()


@pytest.mark.asyncio
async def test_department_isolation_for_apparatus_routes() -> None:
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(text("select 1"))
        except Exception:
            pytest.skip("Database unavailable for tenancy test")

        await _purge_email(session, "user.a@example.com")
        await _purge_email(session, "user.b@example.com")

        dept_a = Department(name="Dept A")
        dept_b = Department(name="Dept B")
        session.add_all([dept_a, dept_b])
        await session.flush()

        user_a = User(
            department_id=dept_a.id,
            name="User A",
            email="user.a@example.com",
            password_hash=hash_password("test-password"),
            role="admin",
        )
        user_b = User(
            department_id=dept_b.id,
            name="User B",
            email="user.b@example.com",
            password_hash=hash_password("test-password"),
            role="admin",
        )
        session.add_all([user_a, user_b])
        await session.flush()

        apparatus_b = Apparatus(
            department_id=dept_b.id,
            unit_id="Engine B",
            service_status="available",
        )
        session.add(apparatus_b)
        await session.commit()

        dept_a_id = dept_a.id
        dept_b_id = dept_b.id
        user_a_id = user_a.id
        user_b_id = user_b.id
        apparatus_b_id = apparatus_b.id

    token_a = create_access_token(
        subject=str(user_a_id),
        claims={"dept": str(dept_a_id), "role": "admin"},
    )

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            list_response = await client.get(
                "/api/v1/assets/apparatus",
                headers={"Authorization": f"Bearer {token_a}"},
            )
            assert list_response.status_code == 200
            assert all(
                row.get("unit_id") != "Engine B" for row in list_response.json()
            )

            update_response = await client.patch(
                f"/api/v1/assets/apparatus/{apparatus_b_id}/status",
                json={"service_status": "responding"},
                headers={"Authorization": f"Bearer {token_a}"},
            )
            assert update_response.status_code == 404
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                delete(Apparatus).where(Apparatus.department_id.in_([dept_a_id, dept_b_id]))
            )
            await session.execute(delete(User).where(User.id.in_([user_a_id, user_b_id])))
            await session.execute(
                delete(Department).where(Department.id.in_([dept_a_id, dept_b_id]))
            )
            await session.commit()
