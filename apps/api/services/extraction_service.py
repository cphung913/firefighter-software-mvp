"""AI extraction: pulls session transcripts and calls Claude to produce NERIS field-value pairs."""
from __future__ import annotations

import json
import logging
from typing import Any

import anthropic

from core.config import settings
from schemas.voice import ExtractionResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt — cached on the Anthropic side (cache_control: ephemeral).
# Contains the full NERIS field taxonomy so every call benefits from the
# cache hit without re-tokenising the reference data.
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are an AI assistant that helps volunteer firefighters complete \
NERIS 2026 incident reports from voice logs recorded during or after a fire call.

You will receive concatenated transcripts from one or more crew members. Your job is \
to extract factual NERIS field values that are clearly stated in the transcripts. \
Return a single JSON object matching the provided schema. For any field that is \
ambiguous, inferred rather than stated, or not mentioned at all, set the value \
to null and confidence to 0.0 — never guess.

NERIS field reference:
- incident_type: one of: structure_fire | vehicle_fire | medical_assist | \
motor_vehicle_collision | rescue_extrication | hazmat_gas_leak | public_service | \
false_alarm
- location_address: street address as spoken
- alarm_time: ISO-8601 datetime or null
- dispatch_time: ISO-8601 datetime or null
- en_route_time: ISO-8601 datetime or null
- on_scene_time: ISO-8601 datetime or null
- controlled_time: ISO-8601 datetime or null
- cleared_time: ISO-8601 datetime or null
- units_responding: array of unit identifiers as spoken (e.g. ["Engine 1", "Tanker 3"])
- personnel_on_scene: array of names or badge numbers as spoken
- casualty_civilian: integer count or null
- casualty_ff: integer count or null
- actions_taken: array of zero or more from: fire_attack | overhaul | ventilation | \
patient_care | traffic_control | water_supply | hazmat_isolation | scene_investigation
- property_use: one of: one_two_family_dwelling | multi_family_residential | \
commercial_mercantile | industrial_utility | roadway_highway | wildland_open_land | \
public_assembly | other
- narrative: a plain-English summary of the incident drawn from the transcripts; \
2-4 sentences; null if transcripts are too sparse

Respond with ONLY the JSON object — no markdown fences, no explanation."""

_SCHEMA_JSON = json.dumps(ExtractionResult.model_json_schema(), indent=2)


def _build_user_content(transcripts: list[str], gps: str | None, roster: list[str], apparatus: list[str]) -> str:
    lines: list[str] = []

    if gps:
        lines.append(f"GPS at dispatch: {gps}")
    if roster:
        lines.append(f"Crew on scene: {', '.join(roster)}")
    if apparatus:
        lines.append(f"Apparatus: {', '.join(apparatus)}")

    lines.append("\n--- Transcripts (chronological) ---")
    for i, t in enumerate(transcripts, 1):
        lines.append(f"[{i}] {t.strip()}")

    return "\n".join(lines)


def _coerce_extraction(raw: dict[str, Any]) -> ExtractionResult:
    normalized: dict[str, Any] = {}
    for field_name in ExtractionResult.model_fields:
        value = raw.get(field_name)
        if isinstance(value, dict):
            confidence = value.get("confidence", 0.0)
            try:
                confidence = float(confidence)
            except (TypeError, ValueError):
                confidence = 0.0
            normalized[field_name] = {
                "value": value.get("value"),
                "confidence": max(0.0, min(1.0, confidence)),
            }
        else:
            normalized[field_name] = {
                "value": value,
                "confidence": 0.0 if value is None else 0.25,
            }
    return ExtractionResult.model_validate(normalized)


async def extract_neris_fields(
    *,
    transcripts: list[str],
    gps: str | None = None,
    roster: list[str] | None = None,
    apparatus: list[str] | None = None,
) -> ExtractionResult:
    """Call Claude with prompt caching and return extracted NERIS fields.

    Uses claude-sonnet-4-6 — accurate enough for structured extraction and
    fast enough that officers aren't waiting. Upgrade to opus-4-7 if field
    accuracy on edge cases needs improvement in production.
    """
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — returning empty extraction")
        return ExtractionResult()

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    user_text = _build_user_content(
        transcripts=transcripts,
        gps=gps,
        roster=roster or [],
        apparatus=apparatus or [],
    )

    response = await client.messages.create(
        model=settings.AI_MODEL,
        max_tokens=1024,
        temperature=0.1,
        system=[
            {
                "type": "text",
                "text": f"{_SYSTEM_PROMPT}\n\nJSON schema:\n{_SCHEMA_JSON}",
                # Prompt caching: system prompt + taxonomy is large and static;
                # cache it so repeated extractions in the same 5-min window
                # pay ~10% of the input token cost.
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_text}],
    )

    blocks = [block.text for block in response.content if getattr(block, "text", None)]
    raw = "\n".join(blocks).strip()

    try:
        extracted: dict[str, Any] = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Claude returned non-JSON: %s", raw[:200])
        extracted = {}

    return _coerce_extraction(extracted)
