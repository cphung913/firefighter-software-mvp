"""Department analytics: response times, NFPA 1720 compliance, trends."""

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, get_current_user
from models.department import Department
from models.incident import Incident
from models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])

NFPA_1720 = {
    "urban": {"total_response_seconds": 14 * 60, "staffing": 15},
    "suburban": {"total_response_seconds": 17 * 60, "staffing": 10},
    "rural": {"total_response_seconds": 26 * 60, "staffing": 6},
    "remote": {"total_response_seconds": 26 * 60, "staffing": 4},
}
DEFAULT_AREA_TYPE = "suburban"


def calc_response_times(incident: Incident) -> dict[str, int | None]:
    """Compute interval seconds; None if endpoints missing or delta invalid."""

    def delta_seconds(start: datetime | None, end: datetime | None) -> int | None:
        if start is None or end is None:
            return None
        secs = int((end - start).total_seconds())
        return secs if secs >= 0 else None

    dispatch = incident.dispatch_time
    en_route = incident.en_route_time
    on_scene = incident.on_scene_time
    cleared = incident.cleared_time

    return {
        "turnout_seconds": delta_seconds(dispatch, en_route),
        "travel_seconds": delta_seconds(en_route, on_scene),
        "total_response_seconds": delta_seconds(dispatch, on_scene),
        "incident_duration_seconds": delta_seconds(dispatch, cleared),
    }


def nfpa_benchmark_seconds(area_type: str | None) -> int:
    key = (area_type or DEFAULT_AREA_TYPE).lower()
    if key not in NFPA_1720:
        key = DEFAULT_AREA_TYPE
    return int(NFPA_1720[key]["total_response_seconds"])


def percentile_90(values: list[int]) -> float | None:
    if not values:
        return None
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    rank = int(math.ceil(0.9 * n))
    idx = min(max(rank - 1, 0), n - 1)
    return float(sorted_vals[idx])


def avg_or_none(nums: list[int]) -> float | None:
    return float(sum(nums) / len(nums)) if nums else None


def week_start_monday(alarm: datetime) -> datetime.date:
    if alarm.tzinfo is None:
        alarm = alarm.replace(tzinfo=timezone.utc)
    d = alarm.astimezone(timezone.utc).date()
    return d - timedelta(days=d.weekday())


@router.get("/response-times/summary")
async def response_time_summary(
    days: int = Query(default=90, ge=1, le=365),
    incident_type: str | None = Query(default=None),
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = select(Incident).where(
        Incident.department_id == department.id,
        Incident.alarm_time.is_not(None),
        Incident.alarm_time >= cutoff,
    )
    if incident_type is not None:
        stmt = stmt.where(Incident.incident_type == incident_type)

    result = await db.scalars(stmt)
    incidents = list(result.all())

    benchmark = nfpa_benchmark_seconds(DEFAULT_AREA_TYPE)

    turnout_vals: list[int] = []
    travel_vals: list[int] = []
    total_vals: list[int] = []
    compliant_with_total = 0

    type_counts: dict[str | None, int] = defaultdict(int)
    type_total_resp: dict[str | None, list[int]] = defaultdict(list)

    for inc in incidents:
        rt = calc_response_times(inc)
        t_key = inc.incident_type
        type_counts[t_key] += 1
        tr = rt["total_response_seconds"]
        if tr is not None:
            type_total_resp[t_key].append(tr)

        if rt["turnout_seconds"] is not None:
            turnout_vals.append(rt["turnout_seconds"])
        if rt["travel_seconds"] is not None:
            travel_vals.append(rt["travel_seconds"])
        if tr is not None:
            total_vals.append(tr)
            if tr <= benchmark:
                compliant_with_total += 1

    incidents_with_response_data = len(total_vals)
    compliance_pct = (
        (compliant_with_total / incidents_with_response_data) * 100
        if incidents_with_response_data
        else None
    )

    by_incident_type_list: list[dict[str, object]] = []
    for itype in sorted(type_counts.keys(), key=lambda x: (x is None, str(x or ""))):
        tr_list = type_total_resp.get(itype, [])
        by_incident_type_list.append(
            {
                "incident_type": itype if itype is not None else "",
                "count": type_counts[itype],
                "avg_total_response_seconds": avg_or_none(tr_list),
            }
        )

    return {
        "period_days": days,
        "total_incidents": len(incidents),
        "incidents_with_response_data": incidents_with_response_data,
        "avg_turnout_seconds": avg_or_none(turnout_vals),
        "avg_travel_seconds": avg_or_none(travel_vals),
        "avg_total_response_seconds": avg_or_none(total_vals),
        "p90_total_response_seconds": percentile_90(total_vals),
        "nfpa_1720_compliance_pct": compliance_pct,
        "nfpa_benchmark_seconds": benchmark,
        "by_incident_type": by_incident_type_list,
    }


@router.get("/response-times/trend")
async def response_time_trend(
    days: int = Query(default=90, ge=7, le=365),
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = select(Incident).where(
        Incident.department_id == department.id,
        Incident.alarm_time.is_not(None),
        Incident.alarm_time >= cutoff,
    )
    result = await db.scalars(stmt)
    incidents = list(result.all())

    week_totals: dict[datetime.date, list[int]] = defaultdict(list)
    week_turnouts: dict[datetime.date, list[int]] = defaultdict(list)
    week_counts: dict[datetime.date, int] = defaultdict(int)

    for inc in incidents:
        alarm = inc.alarm_time
        assert alarm is not None
        ws = week_start_monday(alarm)
        week_counts[ws] += 1
        rt = calc_response_times(inc)
        if rt["total_response_seconds"] is not None:
            week_totals[ws].append(rt["total_response_seconds"])
        if rt["turnout_seconds"] is not None:
            week_turnouts[ws].append(rt["turnout_seconds"])

    weeks_out: list[dict[str, object]] = []
    for ws in sorted(week_counts.keys()):
        weeks_out.append(
            {
                "week_start": ws.isoformat(),
                "incident_count": week_counts[ws],
                "avg_total_response_seconds": avg_or_none(week_totals[ws]),
                "avg_turnout_seconds": avg_or_none(week_turnouts[ws]),
            }
        )

    return {"weeks": weeks_out}


@router.get("/response-times/incidents")
async def response_time_incidents(
    days: int = Query(default=30, ge=1, le=90),
    limit: int = Query(default=50, ge=1, le=200),
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(Incident)
        .where(
            Incident.department_id == department.id,
            Incident.alarm_time.is_not(None),
            Incident.alarm_time >= cutoff,
        )
        .order_by(Incident.alarm_time.desc())
        .limit(limit)
    )
    result = await db.scalars(stmt)
    incidents = list(result.all())

    benchmark = nfpa_benchmark_seconds(DEFAULT_AREA_TYPE)

    out: list[dict[str, object]] = []
    for inc in incidents:
        rt = calc_response_times(inc)
        total_r = rt["total_response_seconds"]
        meets: bool | None
        if total_r is None:
            meets = None
        else:
            meets = total_r <= benchmark

        alarm_s: str | None = None
        if inc.alarm_time is not None:
            alarm_s = inc.alarm_time.isoformat()

        out.append(
            {
                "incident_id": str(inc.id),
                "incident_number": inc.incident_number,
                "incident_type": inc.incident_type,
                "alarm_time": alarm_s,
                "location_address": inc.location_address,
                "turnout_seconds": rt["turnout_seconds"],
                "travel_seconds": rt["travel_seconds"],
                "total_response_seconds": total_r,
                "meets_nfpa_1720": meets,
            }
        )

    return out
