from __future__ import annotations

import io
import re
import secrets
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import pandas as pd
import pdfplumber
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import hash_password
from models.apparatus import Apparatus
from models.incident import Incident
from models.sync_record import SyncRecord
from models.user import User
from schemas.imports import (
    ImportCommitResponse,
    ImportCommitSummaryOut,
    ImportEntityType,
    ImportFieldMappingOut,
    ImportPreviewResponse,
    ImportPreviewRowOut,
    ImportPreviewSectionOut,
    ImportRowAction,
    ImportRowDiffCellOut,
    ImportSectionSummaryOut,
    ImportUploadResponse,
)

APPARATUS_FIELDS = (
    "unit_id",
    "type",
    "year",
    "make",
    "model",
    "vin",
    "mileage",
    "service_status",
)
PERSONNEL_FIELDS = ("name", "email", "role", "badge_number")
INCIDENT_FIELDS = (
    "incident_number",
    "incident_type",
    "location_address",
    "location_lat",
    "location_lng",
    "alarm_time",
    "dispatch_time",
    "en_route_time",
    "on_scene_time",
    "controlled_time",
    "cleared_time",
    "narrative",
)

ENTITY_FIELDS: dict[ImportEntityType, tuple[str, ...]] = {
    "apparatus": APPARATUS_FIELDS,
    "personnel": PERSONNEL_FIELDS,
    "incidents": INCIDENT_FIELDS,
}

HEADER_ALIASES: dict[str, tuple[str, ...]] = {
    "unit_id": ("unit", "unit number", "apparatus", "apparatus id", "truck", "engine"),
    "type": ("apparatus type", "vehicle type", "rig type"),
    "year": ("model year", "build year"),
    "make": ("manufacturer", "brand"),
    "model": ("trim", "series"),
    "vin": ("vehicle vin", "serial vin"),
    "mileage": ("odometer", "miles"),
    "service_status": ("status", "in service", "out of service", "service state"),
    "name": ("member", "member name", "firefighter", "employee", "personnel"),
    "email": ("email address", "e-mail"),
    "role": ("rank", "title", "position"),
    "badge_number": ("badge", "badge no", "member number"),
    "incident_number": ("run number", "call number", "incident no", "incident #"),
    "incident_type": ("call type", "run type", "dispatch type"),
    "location_address": ("address", "location", "incident address"),
    "location_lat": ("latitude", "lat"),
    "location_lng": ("longitude", "lng", "long"),
    "alarm_time": ("alarm", "call time"),
    "dispatch_time": ("dispatch time", "dispatched"),
    "en_route_time": ("en route", "enroute time", "responding time"),
    "on_scene_time": ("arrival time", "scene time", "on scene"),
    "controlled_time": ("controlled", "under control"),
    "cleared_time": ("clear time", "back in service", "cleared"),
    "narrative": ("notes", "description", "remarks"),
}

FIELD_LABELS = {
    "unit_id": "Unit",
    "type": "Type",
    "year": "Year",
    "make": "Make",
    "model": "Model",
    "vin": "VIN",
    "mileage": "Mileage",
    "service_status": "Status",
    "name": "Name",
    "email": "Email",
    "role": "Role",
    "badge_number": "Badge",
    "incident_number": "Incident #",
    "incident_type": "Incident type",
    "location_address": "Address",
    "location_lat": "Latitude",
    "location_lng": "Longitude",
    "alarm_time": "Alarm time",
    "dispatch_time": "Dispatch time",
    "en_route_time": "En route time",
    "on_scene_time": "On scene",
    "controlled_time": "Controlled time",
    "cleared_time": "Cleared",
    "narrative": "Narrative",
}

PREVIEW_STORE: dict[str, "PreparedUpload"] = {}


class ImportServiceError(Exception):
    pass


class ImportNotFoundError(ImportServiceError):
    pass


@dataclass(slots=True)
class ParsedDataset:
    label: str
    headers: list[str]
    rows: list[dict[str, Any]]


@dataclass(slots=True)
class PreparedRow:
    row_index: int
    action: ImportRowAction
    match_reason: str | None
    warnings: list[str]
    changed_fields: list[str]
    incoming: dict[str, Any]
    current: dict[str, Any] | None
    diff: dict[str, dict[str, Any]]
    existing_id: uuid.UUID | None
    raw_extras: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class PreparedSection:
    dataset_label: str
    entity_type: ImportEntityType
    mappings: list[ImportFieldMappingOut]
    warnings: list[str]
    rows: list[PreparedRow]


@dataclass(slots=True)
class PreparedUpload:
    upload_id: str
    department_id: uuid.UUID
    file_name: str
    sections: list[PreparedSection]
    created_at: datetime


@dataclass(slots=True)
class ExistingContext:
    users: list[User]
    users_by_email: dict[str, User]
    users_by_badge: dict[str, User]
    users_by_name: dict[str, User]
    apparatus_by_unit: dict[str, Apparatus]
    apparatus_by_vin: dict[str, Apparatus]
    incidents_by_number: dict[str, Incident]


async def stage_upload(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    file_name: str,
    content: bytes,
) -> ImportUploadResponse:
    datasets = _parse_upload(file_name, content)
    if not datasets:
        raise ImportServiceError("No readable tables were found in that file.")

    context = await _load_existing_context(db, department_id)
    sections: list[PreparedSection] = []

    for dataset in datasets:
        entity_type = _infer_entity_type(dataset.headers)
        mappings, section_warnings = _build_mappings(entity_type, dataset.headers)
        rows = _build_preview_rows(entity_type, dataset, mappings, context)
        _mark_duplicate_rows(entity_type, rows)
        sections.append(
            PreparedSection(
                dataset_label=dataset.label,
                entity_type=entity_type,
                mappings=mappings,
                warnings=section_warnings,
                rows=rows,
            )
        )

    upload_id = str(uuid.uuid4())
    PREVIEW_STORE[upload_id] = PreparedUpload(
        upload_id=upload_id,
        department_id=department_id,
        file_name=file_name,
        sections=sections,
        created_at=datetime.now(UTC),
    )

    return ImportUploadResponse(
        upload_id=upload_id,
        file_name=file_name,
        sections=[
            ImportSectionSummaryOut(
                dataset_label=section.dataset_label,
                entity_type=section.entity_type,
                row_count=len(section.rows),
                mapped_fields=sum(1 for mapping in section.mappings if mapping.target_field),
                warnings=section.warnings,
            )
            for section in sections
        ],
    )


def get_preview(upload_id: str, department_id: uuid.UUID) -> ImportPreviewResponse:
    staged = PREVIEW_STORE.get(upload_id)
    if staged is None or staged.department_id != department_id:
        raise ImportNotFoundError("This import preview has expired. Upload the file again.")

    return ImportPreviewResponse(
        upload_id=staged.upload_id,
        file_name=staged.file_name,
        sections=[
            ImportPreviewSectionOut(
                dataset_label=section.dataset_label,
                entity_type=section.entity_type,
                mappings=section.mappings,
                warnings=section.warnings,
                rows=[
                    ImportPreviewRowOut(
                        row_index=row.row_index,
                        action=row.action,
                        match_reason=row.match_reason,
                        warnings=row.warnings,
                        changed_fields=row.changed_fields,
                        incoming=row.incoming,
                        current=row.current,
                        diff={
                            key: ImportRowDiffCellOut(
                                current=value.get("current"),
                                incoming=value.get("incoming"),
                            )
                            for key, value in row.diff.items()
                        },
                    )
                    for row in section.rows
                ],
            )
            for section in staged.sections
        ],
    )


async def commit_preview(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    user_id: uuid.UUID,
    upload_id: str,
) -> ImportCommitResponse:
    staged = PREVIEW_STORE.get(upload_id)
    if staged is None or staged.department_id != department_id:
        raise ImportNotFoundError("This import preview has expired. Upload the file again.")

    context = await _load_existing_context(db, department_id)
    summaries = {
        entity: ImportCommitSummaryOut(entity_type=entity)
        for entity in ENTITY_FIELDS
    }

    sections = sorted(staged.sections, key=lambda section: _section_commit_order(section.entity_type))
    for section in sections:
        for row in section.rows:
            summary = summaries[section.entity_type]
            if row.action == "skip":
                summary.skipped += 1
                continue
            if row.action == "error":
                summary.errors += 1
                continue

            if section.entity_type == "personnel":
                created = await _commit_personnel_row(
                    db,
                    department_id=department_id,
                    row=row,
                    context=context,
                )
            elif section.entity_type == "apparatus":
                created = await _commit_apparatus_row(
                    db,
                    department_id=department_id,
                    user_id=user_id,
                    row=row,
                    context=context,
                )
            else:
                created = await _commit_incident_row(
                    db,
                    department_id=department_id,
                    user_id=user_id,
                    row=row,
                    context=context,
                )

            if created:
                summary.created += 1
            else:
                summary.updated += 1

    await db.commit()
    PREVIEW_STORE.pop(upload_id, None)

    return ImportCommitResponse(
        upload_id=upload_id,
        file_name=staged.file_name,
        summaries=list(summaries.values()),
        committed_at=datetime.now(UTC),
    )


def _parse_upload(file_name: str, content: bytes) -> list[ParsedDataset]:
    extension = Path(file_name).suffix.lower()
    if extension == ".csv":
        dataframe = pd.read_csv(io.BytesIO(content), dtype=object)
        return [_dataframe_to_dataset("CSV import", dataframe)]
    if extension in {".xlsx", ".xls"}:
        workbook = pd.ExcelFile(io.BytesIO(content))
        datasets: list[ParsedDataset] = []
        for sheet_name in workbook.sheet_names:
            dataframe = workbook.parse(sheet_name=sheet_name, dtype=object)
            datasets.append(_dataframe_to_dataset(sheet_name, dataframe))
        return [dataset for dataset in datasets if dataset.rows]
    if extension == ".pdf":
        return _pdf_to_datasets(content)
    raise ImportServiceError("Unsupported file type. Use CSV, XLSX, XLS, or PDF.")


def _dataframe_to_dataset(label: str, dataframe: pd.DataFrame) -> ParsedDataset:
    cleaned = dataframe.dropna(axis=0, how="all").dropna(axis=1, how="all")
    headers = [_coerce_header(column, index) for index, column in enumerate(cleaned.columns)]
    cleaned.columns = headers
    cleaned = cleaned.where(pd.notna(cleaned), None)

    rows: list[dict[str, Any]] = []
    for _, series in cleaned.iterrows():
        row = {header: _clean_value(series[header]) for header in headers}
        if any(value not in (None, "") for value in row.values()):
            rows.append(row)

    return ParsedDataset(label=label, headers=headers, rows=rows)


def _pdf_to_datasets(content: bytes) -> list[ParsedDataset]:
    datasets: list[ParsedDataset] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            for table_index, table in enumerate(tables, start=1):
                if not table or len(table) < 2:
                    continue
                raw_headers = table[0]
                headers = [
                    _coerce_header(value, column_index)
                    for column_index, value in enumerate(raw_headers)
                ]
                rows: list[dict[str, Any]] = []
                for raw_row in table[1:]:
                    values = raw_row[: len(headers)] + [None] * max(0, len(headers) - len(raw_row))
                    row = {
                        header: _clean_value(values[column_index])
                        for column_index, header in enumerate(headers)
                    }
                    if any(value not in (None, "") for value in row.values()):
                        rows.append(row)
                if rows:
                    datasets.append(
                        ParsedDataset(
                            label=f"Page {page_index} Table {table_index}",
                            headers=headers,
                            rows=rows,
                        )
                    )

            if tables:
                continue

            text = page.extract_text()
            if not text:
                continue

            lines = [line.strip() for line in text.splitlines() if line.strip()]
            if len(lines) < 2:
                continue

            split_rows = [re.split(r"\s{2,}", line) for line in lines]
            width = max(len(parts) for parts in split_rows)
            if width < 2:
                continue

            headers = [
                _coerce_header(split_rows[0][index] if index < len(split_rows[0]) else None, index)
                for index in range(width)
            ]
            rows = []
            for raw_row in split_rows[1:]:
                padded = raw_row + [""] * (width - len(raw_row))
                row = {
                    header: _clean_value(padded[column_index])
                    for column_index, header in enumerate(headers)
                }
                if any(value not in (None, "") for value in row.values()):
                    rows.append(row)
            if rows:
                datasets.append(
                    ParsedDataset(
                        label=f"Page {page_index} Text",
                        headers=headers,
                        rows=rows,
                    )
                )

    return datasets


def _coerce_header(value: Any, index: int) -> str:
    cleaned = _clean_value(value)
    if isinstance(cleaned, str) and cleaned:
        return cleaned
    return f"column_{index + 1}"


def _clean_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        if value.hour == 0 and value.minute == 0 and value.second == 0:
            return value.date().isoformat()
        return value.to_pydatetime().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def _normalize_text(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.lower()).split())


def _score_header(header: str, field_name: str) -> float:
    normalized_header = _normalize_text(header)
    candidates = (_normalize_text(field_name),) + tuple(
        _normalize_text(alias) for alias in HEADER_ALIASES.get(field_name, ())
    )
    best = 0.0
    for candidate in candidates:
        if not candidate:
            continue
        score = SequenceMatcher(None, normalized_header, candidate).ratio()
        header_tokens = set(normalized_header.split())
        candidate_tokens = set(candidate.split())
        if candidate_tokens and candidate_tokens.issubset(header_tokens):
            score = max(score, 0.95)
        if header_tokens and header_tokens == candidate_tokens:
            score = 1.0
        best = max(best, score)
    return best


def _infer_entity_type(headers: list[str]) -> ImportEntityType:
    best_entity: ImportEntityType = "apparatus"
    best_score = -1.0
    for entity_type, fields in ENTITY_FIELDS.items():
        if not headers:
            continue
        scores = []
        strong_matches = 0
        for header in headers:
            field_score = max(_score_header(header, field_name) for field_name in fields)
            scores.append(field_score)
            if field_score >= 0.72:
                strong_matches += 1
        average_score = sum(scores) / len(scores)
        composite = average_score + (strong_matches * 0.08)
        if composite > best_score:
            best_entity = entity_type
            best_score = composite
    return best_entity


def _build_mappings(
    entity_type: ImportEntityType, headers: list[str]
) -> tuple[list[ImportFieldMappingOut], list[str]]:
    used_fields: set[str] = set()
    mappings: list[ImportFieldMappingOut] = []
    warnings: list[str] = []

    for header in headers:
        best_field: str | None = None
        best_score = 0.0
        for field_name in ENTITY_FIELDS[entity_type]:
            score = _score_header(header, field_name)
            if score > best_score:
                best_field = field_name
                best_score = score
        if best_score < 0.45:
            best_field = None
        elif best_field in used_fields:
            warnings.append(f"{header} overlaps an existing field mapping and was ignored.")
            best_field = None
        elif best_field is not None:
            used_fields.add(best_field)
        mappings.append(
            ImportFieldMappingOut(
                source_header=header,
                target_field=best_field,
                confidence=round(best_score, 2),
            )
        )

    if not used_fields:
        warnings.append("No strong header matches were found. Double-check this preview before importing.")

    return mappings, warnings


def _build_preview_rows(
    entity_type: ImportEntityType,
    dataset: ParsedDataset,
    mappings: list[ImportFieldMappingOut],
    context: ExistingContext,
) -> list[PreparedRow]:
    mapped_headers = {
        mapping.source_header: mapping.target_field
        for mapping in mappings
        if mapping.target_field is not None
    }
    rows: list[PreparedRow] = []

    for row_index, raw_row in enumerate(dataset.rows, start=1):
        incoming: dict[str, Any] = {}
        extras: dict[str, Any] = {}

        for header, value in raw_row.items():
            target_field = mapped_headers.get(header)
            if target_field is None:
                if value not in (None, ""):
                    extras[header] = value
                continue
            incoming[target_field] = _coerce_field_value(target_field, value)

        warnings = _row_warnings(entity_type, incoming)
        existing = _match_existing(entity_type, incoming, context)
        current = _snapshot_existing(entity_type, existing) if existing else None
        diff = _build_diff(incoming, current)
        changed_fields = list(diff.keys())

        if warnings and _is_missing_required(entity_type, incoming):
            action: ImportRowAction = "error"
        elif existing is None:
            action = "create"
        elif changed_fields:
            action = "update"
        else:
            action = "skip"

        if entity_type == "personnel" and not incoming.get("email"):
            warnings.append("Missing email; a placeholder login email will be generated on import.")

        rows.append(
            PreparedRow(
                row_index=row_index,
                action=action,
                match_reason=_match_reason(entity_type, incoming, existing, context),
                warnings=warnings,
                changed_fields=changed_fields,
                incoming=incoming,
                current=current,
                diff=diff,
                existing_id=getattr(existing, "id", None),
                raw_extras=extras,
            )
        )

    return rows


def _row_warnings(entity_type: ImportEntityType, incoming: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    if entity_type == "apparatus" and not (incoming.get("unit_id") or incoming.get("vin")):
        warnings.append("Needs a unit ID or VIN to import safely.")
    if entity_type == "personnel" and not incoming.get("name"):
        warnings.append("Name is required for personnel imports.")
    if entity_type == "incidents" and not (
        incoming.get("incident_number") or incoming.get("location_address")
    ):
        warnings.append("Incident rows need an incident number or address.")
    return warnings


def _is_missing_required(entity_type: ImportEntityType, incoming: dict[str, Any]) -> bool:
    if entity_type == "apparatus":
        return not (incoming.get("unit_id") or incoming.get("vin"))
    if entity_type == "personnel":
        return not incoming.get("name")
    return not (incoming.get("incident_number") or incoming.get("location_address"))


def _build_diff(
    incoming: dict[str, Any], current: dict[str, Any] | None
) -> dict[str, dict[str, Any]]:
    if current is None:
        return {
            field_name: {"current": None, "incoming": value}
            for field_name, value in incoming.items()
            if value not in (None, "")
        }

    diff: dict[str, dict[str, Any]] = {}
    for field_name, incoming_value in incoming.items():
        current_value = current.get(field_name)
        if _comparable(current_value) != _comparable(incoming_value):
            diff[field_name] = {"current": current_value, "incoming": incoming_value}
    return diff


def _mark_duplicate_rows(entity_type: ImportEntityType, rows: list[PreparedRow]) -> None:
    buckets: dict[str, list[PreparedRow]] = {}
    for row in rows:
        key = _row_key(entity_type, row.incoming)
        if key is None:
            continue
        buckets.setdefault(key, []).append(row)

    for siblings in buckets.values():
        if len(siblings) < 2:
            continue
        for row in siblings:
            row.warnings.append("This file contains duplicate rows for the same record key.")
            row.action = "error"


def _row_key(entity_type: ImportEntityType, incoming: dict[str, Any]) -> str | None:
    if entity_type == "apparatus":
        key = incoming.get("vin") or incoming.get("unit_id")
    elif entity_type == "personnel":
        key = incoming.get("email") or incoming.get("badge_number") or incoming.get("name")
    else:
        key = incoming.get("incident_number")

    if not isinstance(key, str) or not key.strip():
        return None
    return f"{entity_type}:{key.strip().lower()}"


def _coerce_field_value(field_name: str, value: Any) -> Any:
    if value in (None, ""):
        return None

    if field_name in {"year", "mileage"}:
        return _to_int(value)
    if field_name in {"location_lat", "location_lng"}:
        return _to_float(value)
    if field_name in {
        "alarm_time",
        "dispatch_time",
        "en_route_time",
        "on_scene_time",
        "controlled_time",
        "cleared_time",
    }:
        return _to_datetime(value)
    if field_name == "service_status":
        normalized = _normalize_text(str(value)).replace(" ", "_")
        if "out" in normalized:
            return "out_of_service"
        if "respond" in normalized:
            return "responding"
        return "available"
    if field_name == "role":
        normalized = _normalize_text(str(value)).replace(" ", "_")
        if normalized in {"chief", "captain", "lieutenant", "officer"}:
            return "officer"
        if normalized == "admin":
            return "admin"
        return "member"
    if isinstance(value, str):
        return value.strip()
    return value


def _to_int(value: Any) -> int | None:
    try:
        return int(float(str(value)))
    except (TypeError, ValueError):
        return None


def _to_float(value: Any) -> float | None:
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


def _to_datetime(value: Any) -> str | None:
    if value in (None, ""):
        return None
    parsed = pd.to_datetime(value, errors="coerce", utc=True)
    if pd.isna(parsed):
        return None
    return parsed.to_pydatetime().isoformat()


def _comparable(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip().lower()
    return value


async def _load_existing_context(db: AsyncSession, department_id: uuid.UUID) -> ExistingContext:
    users = (
        await db.scalars(select(User).where(User.department_id == department_id))
    ).all()
    apparatus = (
        await db.scalars(select(Apparatus).where(Apparatus.department_id == department_id))
    ).all()
    incidents = (
        await db.scalars(select(Incident).where(Incident.department_id == department_id))
    ).all()

    return ExistingContext(
        users=list(users),
        users_by_email={
            user.email.strip().lower(): user for user in users if user.email and user.email.strip()
        },
        users_by_badge={
            user.badge_number.strip().lower(): user
            for user in users
            if user.badge_number and user.badge_number.strip()
        },
        users_by_name={
            user.name.strip().lower(): user for user in users if user.name and user.name.strip()
        },
        apparatus_by_unit={
            unit.unit_id.strip().lower(): unit for unit in apparatus if unit.unit_id and unit.unit_id.strip()
        },
        apparatus_by_vin={
            unit.vin.strip().lower(): unit for unit in apparatus if unit.vin and unit.vin.strip()
        },
        incidents_by_number={
            incident.incident_number.strip().lower(): incident
            for incident in incidents
            if incident.incident_number and incident.incident_number.strip()
        },
    )


def _match_existing(
    entity_type: ImportEntityType, incoming: dict[str, Any], context: ExistingContext
) -> Any | None:
    if entity_type == "apparatus":
        vin = _lookup_key(incoming.get("vin"))
        if vin and vin in context.apparatus_by_vin:
            return context.apparatus_by_vin[vin]
        unit_id = _lookup_key(incoming.get("unit_id"))
        if unit_id and unit_id in context.apparatus_by_unit:
            return context.apparatus_by_unit[unit_id]
        return None
    if entity_type == "personnel":
        return _resolve_user(incoming.get("email"), incoming.get("badge_number"), incoming.get("name"), context)
    incident_number = _lookup_key(incoming.get("incident_number"))
    return context.incidents_by_number.get(incident_number) if incident_number else None


def _snapshot_existing(entity_type: ImportEntityType, existing: Any) -> dict[str, Any]:
    if entity_type == "apparatus":
        return {
            "unit_id": existing.unit_id,
            "type": existing.type,
            "year": existing.year,
            "make": existing.make,
            "model": existing.model,
            "vin": existing.vin,
            "mileage": existing.mileage,
            "service_status": existing.service_status,
        }
    if entity_type == "personnel":
        return {
            "name": existing.name,
            "email": existing.email,
            "role": existing.role,
            "badge_number": existing.badge_number,
        }
    return {
        "incident_number": existing.incident_number,
        "incident_type": existing.incident_type,
        "location_address": existing.location_address,
        "location_lat": existing.location_lat,
        "location_lng": existing.location_lng,
        "alarm_time": existing.alarm_time.isoformat() if existing.alarm_time else None,
        "dispatch_time": existing.dispatch_time.isoformat() if existing.dispatch_time else None,
        "en_route_time": existing.en_route_time.isoformat() if existing.en_route_time else None,
        "on_scene_time": existing.on_scene_time.isoformat() if existing.on_scene_time else None,
        "controlled_time": existing.controlled_time.isoformat() if existing.controlled_time else None,
        "cleared_time": existing.cleared_time.isoformat() if existing.cleared_time else None,
        "narrative": existing.narrative,
    }


def _match_reason(
    entity_type: ImportEntityType,
    incoming: dict[str, Any],
    existing: Any | None,
    context: ExistingContext,
) -> str | None:
    if existing is None:
        return None
    if entity_type == "apparatus":
        if incoming.get("vin") and _lookup_key(incoming["vin"]) == _lookup_key(existing.vin):
            return "Matched on VIN"
        return "Matched on unit ID"
    if entity_type == "personnel":
        email = incoming.get("email")
        if email and _lookup_key(email) == _lookup_key(existing.email):
            return "Matched on email"
        badge = incoming.get("badge_number")
        if badge and _lookup_key(badge) == _lookup_key(existing.badge_number):
            return "Matched on badge number"
        return "Matched on name"
    return "Matched on incident number"


def _lookup_key(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip().lower()
    return stripped or None


def _resolve_user(
    email: Any,
    badge_number: Any,
    name: Any,
    context: ExistingContext,
) -> User | None:
    email_key = _lookup_key(email)
    if email_key and email_key in context.users_by_email:
        return context.users_by_email[email_key]
    badge_key = _lookup_key(badge_number)
    if badge_key and badge_key in context.users_by_badge:
        return context.users_by_badge[badge_key]
    name_key = _lookup_key(name)
    if name_key and name_key in context.users_by_name:
        return context.users_by_name[name_key]
    return None


def _section_commit_order(entity_type: ImportEntityType) -> int:
    order = {
        "personnel": 0,
        "apparatus": 1,
        "incidents": 2,
    }
    return order[entity_type]


async def _commit_personnel_row(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    row: PreparedRow,
    context: ExistingContext,
) -> bool:
    existing = _resolve_user(
        row.incoming.get("email"),
        row.incoming.get("badge_number"),
        row.incoming.get("name"),
        context,
    )
    created = existing is None
    if existing is None:
        existing = User(
            department_id=department_id,
            name=str(row.incoming.get("name") or "Imported Member"),
            email=_placeholder_email(row.incoming.get("name")),
            password_hash=hash_password(secrets.token_urlsafe(16)),
            role=str(row.incoming.get("role") or "member"),
        )
        db.add(existing)

    if row.incoming.get("name"):
        existing.name = str(row.incoming["name"])
    if row.incoming.get("email"):
        existing.email = str(row.incoming["email"]).strip().lower()
    if row.incoming.get("role"):
        existing.role = str(row.incoming["role"])
    if row.incoming.get("badge_number"):
        existing.badge_number = str(row.incoming["badge_number"])

    await db.flush()
    _index_user(existing, context)
    return created


async def _commit_apparatus_row(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    user_id: uuid.UUID,
    row: PreparedRow,
    context: ExistingContext,
) -> bool:
    existing = _match_existing("apparatus", row.incoming, context)
    created = existing is None
    if existing is None:
        existing = Apparatus(department_id=department_id)
        db.add(existing)

    for field_name in APPARATUS_FIELDS:
        if field_name in row.incoming:
            setattr(existing, field_name, row.incoming[field_name])

    await db.flush()
    _record_sync(db, department_id, "apparatus", existing.id, user_id)
    _index_apparatus(existing, context)
    return created


async def _commit_incident_row(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
    user_id: uuid.UUID,
    row: PreparedRow,
    context: ExistingContext,
) -> bool:
    existing = _match_existing("incidents", row.incoming, context)
    created = existing is None
    if existing is None:
        existing = Incident(department_id=department_id, raw_data={}, created_by=user_id)
        db.add(existing)

    datetime_fields = {
        "alarm_time", "dispatch_time", "en_route_time",
        "on_scene_time", "controlled_time", "cleared_time",
    }
    for field_name in INCIDENT_FIELDS:
        if field_name not in row.incoming:
            continue
        if field_name in datetime_fields:
            setattr(existing, field_name, _maybe_datetime(row.incoming.get(field_name)))
        else:
            setattr(existing, field_name, row.incoming.get(field_name))

    existing.raw_data = {
        **(existing.raw_data or {}),
        **row.raw_extras,
        "imported_at": datetime.now(UTC).isoformat(),
    }
    if existing.created_by is None:
        existing.created_by = user_id

    await db.flush()
    _record_sync(db, department_id, "incidents", existing.id, user_id)
    _index_incident(existing, context)
    return created


def _placeholder_email(name: Any) -> str:
    base = _normalize_text(str(name or "imported member")).replace(" ", ".") or "imported.member"
    return f"{base}.{uuid.uuid4().hex[:8]}@import.local"


def _maybe_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _resolve_user_id(value: Any, context: ExistingContext) -> uuid.UUID | None:
    if not isinstance(value, str) or not value.strip():
        return None
    user = _resolve_user(value, value, value, context)
    return user.id if user else None


def _record_sync(
    db: AsyncSession,
    department_id: uuid.UUID,
    table_name: str,
    record_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    db.add(
        SyncRecord(
            department_id=department_id,
            table_name=table_name,
            record_id=record_id,
            local_id=None,
            last_modified_by=user_id,
            is_deleted=False,
        )
    )


def _index_user(user: User, context: ExistingContext) -> None:
    for index, existing in enumerate(context.users):
        if existing.id == user.id:
            context.users[index] = user
            break
    else:
        context.users.append(user)

    if user.email:
        context.users_by_email[user.email.strip().lower()] = user
    if user.badge_number:
        context.users_by_badge[user.badge_number.strip().lower()] = user
    if user.name:
        context.users_by_name[user.name.strip().lower()] = user


def _index_apparatus(unit: Apparatus, context: ExistingContext) -> None:
    if unit.unit_id:
        context.apparatus_by_unit[unit.unit_id.strip().lower()] = unit
    if unit.vin:
        context.apparatus_by_vin[unit.vin.strip().lower()] = unit


def _index_incident(incident: Incident, context: ExistingContext) -> None:
    if incident.incident_number:
        context.incidents_by_number[incident.incident_number.strip().lower()] = incident
