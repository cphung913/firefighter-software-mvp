from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import hash_password, verify_password
from models.department import Department
from models.user import User


class AuthError(Exception):
    pass


async def signup_department(
    db: AsyncSession,
    *,
    department_name: str,
    name: str,
    email: str,
    password: str,
) -> User:
    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        raise AuthError("email already registered")

    department = Department(name=department_name)
    db.add(department)
    await db.flush()

    user = User(
        department_id=department.id,
        name=name,
        email=email,
        password_hash=hash_password(password),
        role="admin",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(
    db: AsyncSession, *, email: str, password: str
) -> User | None:
    user = await db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(password, user.password_hash):
        return None
    return user
