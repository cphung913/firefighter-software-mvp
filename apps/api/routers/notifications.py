"""Push notification subscription management and dispatch."""

from __future__ import annotations

import json
from typing import Any
import uuid

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.db import get_db
from core.deps import get_current_department, get_current_user
from models.department import Department
from models.notification import PushSubscription
from models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


class PushSubscribeRequest(BaseModel):
    endpoint: str
    p256dh_key: str
    auth_key: str
    user_agent: str | None = None


class VapidPublicKeyResponse(BaseModel):
    public_key: str | None


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse)
async def get_vapid_public_key(_user: User = Depends(get_current_user)) -> VapidPublicKeyResponse:
    return VapidPublicKeyResponse(public_key=settings.VAPID_PUBLIC_KEY)


@router.post("/subscribe", status_code=204)
async def subscribe(
    payload: PushSubscribeRequest,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(delete(PushSubscription).where(PushSubscription.endpoint == payload.endpoint))
    sub = PushSubscription(
        user_id=user.id,
        department_id=department.id,
        endpoint=payload.endpoint,
        p256dh_key=payload.p256dh_key,
        auth_key=payload.auth_key,
        user_agent=payload.user_agent,
    )
    db.add(sub)
    await db.commit()


@router.delete("/unsubscribe", status_code=204)
async def unsubscribe(
    payload: PushSubscribeRequest = Body(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == payload.endpoint,
            PushSubscription.user_id == user.id,
        )
    )
    await db.commit()


async def send_push_to_department(
    db: AsyncSession,
    department_id: Any,
    title: str,
    body: str,
    url: str = "/dispatch",
    data: dict | None = None,
) -> None:
    """Send a push notification to all subscribed users in a department."""
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        return

    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        return

    subs_result = await db.scalars(
        select(PushSubscription).where(PushSubscription.department_id == department_id)
    )
    subs = subs_result.all()

    payload_json = json.dumps(
        {
            "title": title,
            "body": body,
            "url": url,
            **(data or {}),
        }
    )

    expired_ids: list[uuid.UUID] = []
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key},
                },
                data=payload_json,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIM_EMAIL}"},
            )
        except WebPushException as e:
            resp = getattr(e, "response", None)
            code = getattr(resp, "status_code", None) if resp is not None else None
            if code in (404, 410):
                expired_ids.append(sub.id)
        except Exception:
            pass

    if expired_ids:
        await db.execute(delete(PushSubscription).where(PushSubscription.id.in_(expired_ids)))
        await db.commit()
