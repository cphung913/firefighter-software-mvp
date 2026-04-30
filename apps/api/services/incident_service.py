"""Incident business logic: sequence generation and NERIS export."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.department import Department
from models.incident import Incident


# ---------------------------------------------------------------------------
# NERIS taxonomy (mirrors frontend options.ts — single source of truth here)
# ---------------------------------------------------------------------------

NERIS_INCIDENT_TYPES = [
    {"value": "structure_fire", "label": "Structure fire"},
    {"value": "vehicle_fire", "label": "Vehicle fire"},
    {"value": "medical_assist", "label": "Medical assist"},
    {"value": "motor_vehicle_collision", "label": "Motor vehicle collision"},
    {"value": "rescue_extrication", "label": "Rescue / extrication"},
    {"value": "hazmat_gas_leak", "label": "Hazmat / gas leak"},
    {"value": "public_service", "label": "Public service"},
    {"value": "false_alarm", "label": "False alarm"},
]

ACTION_TAKEN_CODES = [
    {"value": "fire_attack", "label": "Fire attack"},
    {"value": "overhaul", "label": "Overhaul"},
    {"value": "ventilation", "label": "Ventilation"},
    {"value": "patient_care", "label": "Patient care"},
    {"value": "traffic_control", "label": "Traffic control"},
    {"value": "water_supply", "label": "Water supply"},
    {"value": "hazmat_isolation", "label": "Hazmat isolation"},
    {"value": "scene_investigation", "label": "Scene investigation"},
]

PROPERTY_USE_CODES = [
    {"value": "one_two_family_dwelling", "label": "1-2 family dwelling"},
    {"value": "multi_family_residential", "label": "Multi-family residential"},
    {"value": "commercial_mercantile", "label": "Commercial / mercantile"},
    {"value": "industrial_utility", "label": "Industrial / utility"},
    {"value": "roadway_highway", "label": "Roadway / highway"},
    {"value": "wildland_open_land", "label": "Wildland / open land"},
    {"value": "public_assembly", "label": "Public assembly"},
    {"value": "other", "label": "Other"},
]


# ---------------------------------------------------------------------------
# Sequence
# ---------------------------------------------------------------------------

async def next_incident_number(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    alarm_time: datetime | None,
) -> str:
    """Atomically increment and return the next incident number for a department.

    Format: YYYY-NNNNNN  (e.g. 2026-000001)
    """
    result = await db.execute(
        update(Department)
        .where(Department.id == department_id)
        .values(incident_seq=Department.incident_seq + 1)
        .returning(Department.incident_seq)
    )
    seq: int = result.scalar_one()

    year = (alarm_time or datetime.now(timezone.utc)).year
    return f"{year}-{seq:06d}"


# ---------------------------------------------------------------------------
# NERIS JSON export
# ---------------------------------------------------------------------------

_INCIDENT_TYPE_LABELS = {item["value"]: item["label"] for item in NERIS_INCIDENT_TYPES}
_ACTION_LABELS = {item["value"]: item["label"] for item in ACTION_TAKEN_CODES}
_PROPERTY_LABELS = {item["value"]: item["label"] for item in PROPERTY_USE_CODES}


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def to_neris_json(incident: Incident, department: Department) -> dict[str, Any]:
    """Produce a NERIS 2026-aligned JSON payload for a single incident.

    raw_data JSONB is merged in last so any FEMA field additions survive
    without a migration.
    """
    base: dict[str, Any] = {
        "schema_version": "neris-2026",
        "incident_id": str(incident.id),
        "incident_number": incident.incident_number,
        "department": {
            "id": str(department.id),
            "name": department.name,
            "fdid": department.fdid,
            "state": department.state,
        },
        "incident_type": {
            "code": incident.incident_type,
            "label": _INCIDENT_TYPE_LABELS.get(incident.incident_type or "", incident.incident_type or ""),
        },
        "location": {
            "address": incident.location_address,
            "latitude": incident.location_lat,
            "longitude": incident.location_lng,
        },
        "timeline": {
            "alarm": _iso(incident.alarm_time),
            "dispatch": _iso(incident.dispatch_time),
            "en_route": _iso(incident.en_route_time),
            "on_scene": _iso(incident.on_scene_time),
            "controlled": _iso(incident.controlled_time),
            "cleared": _iso(incident.cleared_time),
        },
        "resources": {
            "units_responding": incident.units_responding,
            "personnel_on_scene": incident.personnel_on_scene,
        },
        "casualties": {
            "civilian": incident.casualty_civilian,
            "firefighter": incident.casualty_ff,
        },
        "actions_taken": [
            {"code": code, "label": _ACTION_LABELS.get(code, code)}
            for code in (incident.actions_taken or [])
        ],
        "property_use": {
            "code": incident.property_use,
            "label": _PROPERTY_LABELS.get(incident.property_use or "", incident.property_use or ""),
        } if incident.property_use else None,
        "narrative": incident.narrative,
        "created_at": _iso(incident.created_at),
        "updated_at": _iso(incident.updated_at),
    }

    # Merge raw_data last — FEMA additions live here without migrations
    if incident.raw_data:
        base["raw_data"] = incident.raw_data

    return base


# ---------------------------------------------------------------------------
# List helper
# ---------------------------------------------------------------------------

async def list_incidents(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[Incident]:
    rows = await db.scalars(
        select(Incident)
        .where(Incident.department_id == department_id)
        .order_by(Incident.alarm_time.desc().nulls_last(), Incident.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows.all())
