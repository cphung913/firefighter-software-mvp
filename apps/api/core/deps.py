import uuid
from typing import TypedDict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.security import decode_access_token
from models.department import Department
from models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


class TokenClaims(TypedDict):
    sub: str
    dept: str
    role: str


async def get_token_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> TokenClaims:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(credentials.credentials)
        return {
            "sub": payload["sub"],
            "dept": payload["dept"],
            "role": payload["role"],
        }
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user(
    claims: TokenClaims = Depends(get_token_claims),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        user_id = uuid.UUID(claims["sub"])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found"
        )

    if str(user.department_id) != claims["dept"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid department"
        )
    if user.role != claims["role"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid role"
        )

    return user


async def get_current_department(
    claims: TokenClaims = Depends(get_token_claims),
    db: AsyncSession = Depends(get_db),
) -> Department:
    try:
        department_id = uuid.UUID(claims["dept"])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid department",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    department = await db.get(Department, department_id)
    if department is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="department not found",
        )
    return department


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin access required",
        )
    return user
