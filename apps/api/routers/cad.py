"""CAD webhook endpoint — receives dispatches from external CAD systems."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.db import get_db
from models.department import Department
from models.incident import Incident
from schemas.cad import CadWebhookPayload
from services.incident_service import NERIS_INCIDENT_TYPES, next_incident_number

router = APIRouter(prefix="/cad", tags=["cad"])


async def get_department_from_cad_headers(
    x_cad_secret: str | None = Header(None, alias="X-CAD-Secret"),
    x_department_id: str | None = Header(None, alias="X-Department-ID"),
    x_department_fdid: str | None = Header(None, alias="X-Department-FDID"),
    db: AsyncSession = Depends(get_db),
) -> Department:
    """Identify department from CAD webhook headers (machine-to-machine)."""
    if settings.CAD_WEBHOOK_SECRET:
        if x_cad_secret != settings.CAD_WEBHOOK_SECRET:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid CAD webhook secret",
            )

    department: Department | None = None
    if x_department_id:
        try:
            dept_uuid = uuid.UUID(x_department_id.strip())
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-Department-ID",
            ) from exc
        department = await db.get(Department, dept_uuid)
    elif x_department_fdid and x_department_fdid.strip():
        fdid = x_department_fdid.strip()
        department = await db.scalar(select(Department).where(Department.fdid == fdid))
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Department-ID or X-Department-FDID header required",
        )

    if department is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found",
        )
    return department


# Map common CAD type strings to NERIS incident_type codes
CAD_TYPE_MAP = {
    "structure fire": "structure_fire",
    "structure_fire": "structure_fire",
    "building fire": "structure_fire",
    "vehicle fire": "vehicle_fire",
    "car fire": "vehicle_fire",
    "medical": "medical_assist",
    "ems": "medical_assist",
    "mva": "motor_vehicle_collision",
    "motor vehicle": "motor_vehicle_collision",
    "accident": "motor_vehicle_collision",
    "rescue": "rescue_extrication",
    "extrication": "rescue_extrication",
    "hazmat": "hazmat_gas_leak",
    "gas leak": "hazmat_gas_leak",
    "false alarm": "false_alarm",
    "alarm": "false_alarm",
    "public service": "public_service",
    "service call": "public_service",
}


def normalize_incident_type(raw: str | None) -> str | None:
    if not raw:
        return None
    lower = raw.lower().strip()
    # Check if it's already a valid NERIS code
    valid_codes = {item["value"] for item in NERIS_INCIDENT_TYPES}
    if lower in valid_codes:
        return lower
    # Try mapping
    return CAD_TYPE_MAP.get(lower)


def normalize_priority(raw: str | None) -> str:
    if not raw:
        return "medium"
    mapping = {
        "1": "critical",
        "2": "high",
        "3": "medium",
        "4": "low",
        "critical": "critical",
        "high": "high",
        "medium": "medium",
        "low": "low",
        "emergency": "critical",
        "urgent": "high",
    }
    return mapping.get(str(raw).lower(), "medium")


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        pass
    for fmt in [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
    ]:
        try:
            dt = datetime.strptime(value, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def _build_address(payload: CadWebhookPayload) -> str | None:
    parts: list[str] = []
    if payload.address and payload.address.strip():
        parts.append(payload.address.strip())
    if payload.cross_street and payload.cross_street.strip():
        parts.append(f"xs: {payload.cross_street.strip()}")
    if payload.city and payload.city.strip():
        parts.append(payload.city.strip())
    return ", ".join(parts) if parts else None


def _build_narrative(payload: CadWebhookPayload) -> str | None:
    chunks: list[str] = []
    if payload.nature_of_call and payload.nature_of_call.strip():
        chunks.append(payload.nature_of_call.strip())
    if payload.notes and payload.notes.strip():
        chunks.append(payload.notes.strip())
    extras: list[str] = []
    if payload.fdid and payload.fdid.strip():
        extras.append(f"CAD FDID: {payload.fdid.strip()}")
    if payload.department_name and payload.department_name.strip():
        extras.append(f"CAD dept: {payload.department_name.strip()}")
    if extras:
        chunks.append(" | ".join(extras))
    return "\n\n".join(chunks) if chunks else None


@router.post("/webhook", status_code=201)
async def cad_webhook(
    payload: CadWebhookPayload,
    department: Department = Depends(get_department_from_cad_headers),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Receive a dispatch from an external CAD system.
    Validates X-CAD-Secret when CAD_WEBHOOK_SECRET is configured.
    Requires X-Department-ID or X-Department-FDID.
    Creates an incident record and returns {incident_id, incident_number}.
    """
    pri = normalize_priority(payload.priority)
    alarm_time = parse_time(payload.alarm_time) or parse_time(payload.dispatch_time)
    dispatch_time_dt = parse_time(payload.dispatch_time) or datetime.now(timezone.utc)

    incident_number = await next_incident_number(
        db, department_id=department.id, alarm_time=alarm_time
    )

    incident = Incident(
        department_id=department.id,
        local_id=None,
        incident_number=incident_number,
        created_by=None,
        incident_type=normalize_incident_type(payload.incident_type),
        priority=pri,
        location_address=_build_address(payload),
        location_lat=payload.latitude,
        location_lng=payload.longitude,
        alarm_time=alarm_time,
        dispatch_time=dispatch_time_dt,
        units_responding=list(payload.units or []),
        personnel_on_scene=[],
        narrative=_build_narrative(payload),
        raw_data={
            "cad_call_id": payload.call_id,
            "cad_raw": payload.raw,
            "priority": pri,
        },
        sync_status="synced",
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)

    try:
        from routers.notifications import send_push_to_department

        await send_push_to_department(
            db,
            department.id,
            title="New dispatch",
            body=f"{incident.incident_number}: {incident.location_address or 'Unknown location'}",
            url="/dispatch",
            data={"incident_id": str(incident.id)},
        )
    except Exception:
        pass

    return {"incident_id": str(incident.id), "incident_number": incident.incident_number}


@router.get("/test", status_code=200)
async def cad_test(_department: Department = Depends(get_department_from_cad_headers)) -> dict:
    """Test endpoint to verify CAD webhook headers and optional secret."""
    return {"status": "ok", "message": "CAD webhook endpoint is active"}
