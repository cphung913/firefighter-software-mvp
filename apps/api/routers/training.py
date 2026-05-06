import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, get_current_user, require_admin
from models.department import Department
from models.training import Certification, TrainingAttendee, TrainingDrill
from models.user import User
from schemas.training import (
    AttendeeAddRequest,
    AttendeeOut,
    CertificationCreate,
    CertificationOut,
    CertificationUpdate,
    ISOCategoryStats,
    ISOReportOut,
    MemberTrainingSummary,
    TrainingDrillCreate,
    TrainingDrillOut,
    TrainingDrillUpdate,
)

router = APIRouter(prefix="/training", tags=["training"])


def _require_officer_or_admin(user: User) -> None:
    if user.role not in ("officer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="officer or admin access required",
        )


def _drill_out(drill: TrainingDrill, attendee_count: int, attendees: list[AttendeeOut] | None = None) -> TrainingDrillOut:
    return TrainingDrillOut(
        id=drill.id,
        department_id=drill.department_id,
        drill_type=drill.drill_type,
        title=drill.title,
        description=drill.description,
        drill_date=drill.drill_date,
        hours=float(drill.hours),
        instructor=drill.instructor,
        location=drill.location,
        iso_category=drill.iso_category,
        created_by=drill.created_by,
        attendee_count=attendee_count,
        attendees=attendees or [],
        created_at=drill.created_at,
        updated_at=drill.updated_at,
    )


def _cert_out(cert: Certification, today: date) -> CertificationOut:
    return CertificationOut(
        id=cert.id,
        department_id=cert.department_id,
        user_id=cert.user_id,
        cert_type=cert.cert_type,
        cert_number=cert.cert_number,
        issuing_body=cert.issuing_body,
        issued_date=cert.issued_date,
        expiry_date=cert.expiry_date,
        status=cert.status,
        document_ref=cert.document_ref,
        days_until_expiry=(cert.expiry_date - today).days,
        created_at=cert.created_at,
        updated_at=cert.updated_at,
    )


async def _get_drill_with_attendees(
    drill: TrainingDrill,
    db: AsyncSession,
) -> TrainingDrillOut:
    rows = await db.execute(
        select(TrainingAttendee, User)
        .join(User, User.id == TrainingAttendee.user_id)
        .where(TrainingAttendee.drill_id == drill.id)
    )
    attendees = [
        AttendeeOut(id=u.id, name=u.name, badge_number=u.badge_number, role=u.role)
        for _, u in rows.all()
    ]
    return _drill_out(drill, len(attendees), attendees)


# ===== Drills =====

@router.get("/drills", response_model=list[TrainingDrillOut])
async def list_drills(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    drill_type: Optional[str] = Query(None),
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[TrainingDrillOut]:
    q = select(TrainingDrill).where(
        TrainingDrill.department_id == department.id,
        TrainingDrill.is_deleted.is_(False),
    )
    if from_date is not None:
        q = q.where(TrainingDrill.drill_date >= datetime.combine(from_date, datetime.min.time()))
    if to_date is not None:
        q = q.where(TrainingDrill.drill_date <= datetime.combine(to_date, datetime.max.time()))
    if drill_type is not None:
        q = q.where(TrainingDrill.drill_type == drill_type)
    q = q.order_by(TrainingDrill.drill_date.desc())

    result = await db.execute(q)
    drills = result.scalars().all()

    out = []
    for drill in drills:
        count = await db.scalar(
            select(func.count()).where(TrainingAttendee.drill_id == drill.id)
        ) or 0
        out.append(_drill_out(drill, count))
    return out


@router.post("/drills", response_model=TrainingDrillOut, status_code=status.HTTP_201_CREATED)
async def create_drill(
    payload: TrainingDrillCreate,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> TrainingDrillOut:
    _require_officer_or_admin(user)

    drill = TrainingDrill(
        department_id=department.id,
        created_by=user.id,
        drill_type=payload.drill_type,
        title=payload.title,
        description=payload.description,
        drill_date=payload.drill_date,
        hours=payload.hours,
        instructor=payload.instructor,
        location=payload.location,
        iso_category=payload.iso_category,
    )
    db.add(drill)
    await db.flush()

    attendees: list[AttendeeOut] = []
    seen: set[uuid.UUID] = set()
    for uid in payload.attendee_ids:
        if uid in seen:
            continue
        seen.add(uid)
        att_user = await db.scalar(
            select(User).where(User.id == uid, User.department_id == department.id)
        )
        if att_user is None:
            continue
        db.add(TrainingAttendee(
            department_id=department.id,
            drill_id=drill.id,
            user_id=uid,
        ))
        attendees.append(AttendeeOut(
            id=att_user.id,
            name=att_user.name,
            badge_number=att_user.badge_number,
            role=att_user.role,
        ))

    await db.commit()
    await db.refresh(drill)
    return _drill_out(drill, len(attendees), attendees)


@router.get("/drills/{drill_id}", response_model=TrainingDrillOut)
async def get_drill(
    drill_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> TrainingDrillOut:
    drill = await db.scalar(
        select(TrainingDrill).where(
            TrainingDrill.id == drill_id,
            TrainingDrill.department_id == department.id,
            TrainingDrill.is_deleted.is_(False),
        )
    )
    if drill is None:
        raise HTTPException(status_code=404, detail="Drill not found")
    return await _get_drill_with_attendees(drill, db)


@router.patch("/drills/{drill_id}", response_model=TrainingDrillOut)
async def update_drill(
    drill_id: uuid.UUID,
    payload: TrainingDrillUpdate,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> TrainingDrillOut:
    _require_officer_or_admin(user)

    drill = await db.scalar(
        select(TrainingDrill).where(
            TrainingDrill.id == drill_id,
            TrainingDrill.department_id == department.id,
            TrainingDrill.is_deleted.is_(False),
        )
    )
    if drill is None:
        raise HTTPException(status_code=404, detail="Drill not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(drill, field, value)
    await db.commit()
    await db.refresh(drill)
    return await _get_drill_with_attendees(drill, db)


@router.delete("/drills/{drill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_drill(
    drill_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> None:
    drill = await db.scalar(
        select(TrainingDrill).where(
            TrainingDrill.id == drill_id,
            TrainingDrill.department_id == department.id,
            TrainingDrill.is_deleted.is_(False),
        )
    )
    if drill is None:
        raise HTTPException(status_code=404, detail="Drill not found")
    drill.is_deleted = True
    await db.commit()


@router.post("/drills/{drill_id}/attendees", response_model=TrainingDrillOut)
async def add_attendees(
    drill_id: uuid.UUID,
    payload: AttendeeAddRequest,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> TrainingDrillOut:
    _require_officer_or_admin(user)

    drill = await db.scalar(
        select(TrainingDrill).where(
            TrainingDrill.id == drill_id,
            TrainingDrill.department_id == department.id,
            TrainingDrill.is_deleted.is_(False),
        )
    )
    if drill is None:
        raise HTTPException(status_code=404, detail="Drill not found")

    existing_result = await db.execute(
        select(TrainingAttendee.user_id).where(TrainingAttendee.drill_id == drill_id)
    )
    existing_ids = {row[0] for row in existing_result.all()}

    for uid in payload.user_ids:
        if uid in existing_ids:
            continue
        att_user = await db.scalar(
            select(User).where(User.id == uid, User.department_id == department.id)
        )
        if att_user is None:
            continue
        db.add(TrainingAttendee(
            department_id=department.id,
            drill_id=drill.id,
            user_id=uid,
        ))
        existing_ids.add(uid)

    await db.commit()
    return await _get_drill_with_attendees(drill, db)


@router.delete("/drills/{drill_id}/attendees/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_attendee(
    drill_id: uuid.UUID,
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> None:
    _require_officer_or_admin(user)

    att = await db.scalar(
        select(TrainingAttendee).where(
            TrainingAttendee.drill_id == drill_id,
            TrainingAttendee.user_id == user_id,
            TrainingAttendee.department_id == department.id,
        )
    )
    if att is None:
        raise HTTPException(status_code=404, detail="Attendee not found")
    await db.delete(att)
    await db.commit()


# ===== Certifications =====

@router.get("/certifications/expiring", response_model=list[CertificationOut])
async def list_expiring_certs(
    days: int = Query(90, ge=1, le=3650),
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[CertificationOut]:
    today = date.today()
    cutoff = today + timedelta(days=days)
    result = await db.execute(
        select(Certification).where(
            Certification.department_id == department.id,
            Certification.expiry_date >= today,
            Certification.expiry_date <= cutoff,
        ).order_by(Certification.expiry_date.asc())
    )
    return [_cert_out(cert, today) for cert in result.scalars().all()]


@router.get("/certifications", response_model=list[CertificationOut])
async def list_certifications(
    user_id: Optional[uuid.UUID] = Query(None),
    expiring_days: Optional[int] = Query(None),
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[CertificationOut]:
    today = date.today()
    q = select(Certification).where(Certification.department_id == department.id)
    if user_id is not None:
        q = q.where(Certification.user_id == user_id)
    if expiring_days is not None:
        cutoff = today + timedelta(days=expiring_days)
        q = q.where(Certification.expiry_date >= today, Certification.expiry_date <= cutoff)
    result = await db.execute(q)
    return [_cert_out(cert, today) for cert in result.scalars().all()]


@router.post("/certifications", response_model=CertificationOut, status_code=status.HTTP_201_CREATED)
async def create_certification(
    payload: CertificationCreate,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> CertificationOut:
    _require_officer_or_admin(user)

    member = await db.scalar(
        select(User).where(User.id == payload.user_id, User.department_id == department.id)
    )
    if member is None:
        raise HTTPException(status_code=404, detail="User not found")

    cert = Certification(department_id=department.id, **payload.model_dump())
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    return _cert_out(cert, date.today())


@router.patch("/certifications/{cert_id}", response_model=CertificationOut)
async def update_certification(
    cert_id: uuid.UUID,
    payload: CertificationUpdate,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> CertificationOut:
    _require_officer_or_admin(user)

    cert = await db.scalar(
        select(Certification).where(
            Certification.id == cert_id,
            Certification.department_id == department.id,
        )
    )
    if cert is None:
        raise HTTPException(status_code=404, detail="Certification not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cert, field, value)
    await db.commit()
    await db.refresh(cert)
    return _cert_out(cert, date.today())


@router.delete("/certifications/{cert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_certification(
    cert_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> None:
    cert = await db.scalar(
        select(Certification).where(
            Certification.id == cert_id,
            Certification.department_id == department.id,
        )
    )
    if cert is None:
        raise HTTPException(status_code=404, detail="Certification not found")
    await db.delete(cert)
    await db.commit()


# ===== Reports =====

@router.get("/members/{user_id}/summary", response_model=MemberTrainingSummary)
async def member_training_summary(
    user_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> MemberTrainingSummary:
    member = await db.scalar(
        select(User).where(User.id == user_id, User.department_id == department.id)
    )
    if member is None:
        raise HTTPException(status_code=404, detail="User not found")

    today = date.today()
    current_year = today.year

    drills_result = await db.execute(
        select(TrainingDrill)
        .join(TrainingAttendee, TrainingAttendee.drill_id == TrainingDrill.id)
        .where(
            TrainingAttendee.user_id == user_id,
            TrainingDrill.department_id == department.id,
            TrainingDrill.is_deleted.is_(False),
            extract("year", TrainingDrill.drill_date) == current_year,
        )
    )
    ytd_drills = list(drills_result.scalars().all())

    total_hours_ytd = sum(float(d.hours) for d in ytd_drills)
    total_drills_ytd = len(ytd_drills)

    hours_by_category: dict[str, float] = {}
    for drill in ytd_drills:
        cat = drill.iso_category or "uncategorized"
        hours_by_category[cat] = hours_by_category.get(cat, 0.0) + float(drill.hours)

    certs_result = await db.execute(
        select(Certification).where(
            Certification.user_id == user_id,
            Certification.department_id == department.id,
        )
    )
    certs = list(certs_result.scalars().all())
    cutoff_90 = today + timedelta(days=90)
    expiring_soon = sum(1 for c in certs if today <= c.expiry_date <= cutoff_90)

    return MemberTrainingSummary(
        user_id=member.id,
        name=member.name,
        badge_number=member.badge_number,
        role=member.role,
        total_hours_ytd=total_hours_ytd,
        total_drills_ytd=total_drills_ytd,
        hours_by_category=hours_by_category,
        certifications=[_cert_out(c, today) for c in certs],
        expiring_soon=expiring_soon,
    )


@router.get("/iso-report", response_model=ISOReportOut)
async def iso_report(
    year: Optional[int] = Query(None),
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> ISOReportOut:
    if year is None:
        year = date.today().year

    drills_result = await db.execute(
        select(TrainingDrill).where(
            TrainingDrill.department_id == department.id,
            TrainingDrill.is_deleted.is_(False),
            extract("year", TrainingDrill.drill_date) == year,
        )
    )
    drills = list(drills_result.scalars().all())
    drills_by_id = {d.id: d for d in drills}

    attendees_result = await db.execute(
        select(TrainingAttendee).where(
            TrainingAttendee.drill_id.in_(list(drills_by_id.keys()))
        )
    )
    attendees = list(attendees_result.scalars().all())

    category_data: dict[str, dict] = {}
    members_with_drill: set = set()
    for att in attendees:
        drill = drills_by_id.get(att.drill_id)
        if drill is None:
            continue
        members_with_drill.add(att.user_id)
        cat = drill.iso_category or "uncategorized"
        if cat not in category_data:
            category_data[cat] = {"hours": 0.0, "drills": set(), "members": set()}
        # Only count drill hours once per drill, not once per attendee
        if drill.id not in category_data[cat]["drills"]:
            category_data[cat]["hours"] += float(drill.hours)
        category_data[cat]["drills"].add(drill.id)
        category_data[cat]["members"].add(att.user_id)

    total_members = await db.scalar(
        select(func.count()).where(User.department_id == department.id)
    ) or 0

    member_compliance_pct = (
        len(members_with_drill) / total_members * 100.0 if total_members > 0 else 0.0
    )

    categories = [
        ISOCategoryStats(
            category=cat,
            total_hours=round(data["hours"], 2),
            drill_count=len(data["drills"]),
            member_count=len(data["members"]),
        )
        for cat, data in sorted(category_data.items())
    ]

    return ISOReportOut(
        department_id=department.id,
        year=year,
        total_training_hours=round(sum(float(d.hours) for d in drills), 2),
        total_drills=len(drills),
        member_compliance_pct=round(member_compliance_pct, 1),
        categories=categories,
        generated_at=datetime.now(timezone.utc),
    )
