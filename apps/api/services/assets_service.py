import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.apparatus import Apparatus


DEFAULT_APPARATUS = [
    {
        "local_id": "seed_engine_1",
        "unit_id": "Engine 1",
        "type": "Engine",
        "year": 2018,
        "make": "Pierce",
        "model": "Enforcer",
        "vin": "4P1CT01N4JA000101",
        "service_status": "available",
        "mileage": 18420,
    },
    {
        "local_id": "seed_tender_4",
        "unit_id": "Tender 4",
        "type": "Tender",
        "year": 2016,
        "make": "Kenworth",
        "model": "T370",
        "vin": "2NKHHM6X5GM123404",
        "service_status": "available",
        "mileage": 22105,
    },
    {
        "local_id": "seed_brush_7",
        "unit_id": "Brush 7",
        "type": "Brush",
        "year": 2020,
        "make": "Ford",
        "model": "F-550",
        "vin": "1FDUF5HT2LEA30707",
        "service_status": "available",
        "mileage": 9870,
    },
]


async def get_apparatus_list(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
) -> list[Apparatus]:
    rows = (
        await db.scalars(
            select(Apparatus)
            .where(Apparatus.department_id == department_id)
            .order_by(Apparatus.unit_id)
        )
    ).all()

    if not rows:
        for seed in DEFAULT_APPARATUS:
            db.add(Apparatus(department_id=department_id, **seed))
        await db.commit()
        rows = (
            await db.scalars(
                select(Apparatus)
                .where(Apparatus.department_id == department_id)
                .order_by(Apparatus.unit_id)
            )
        ).all()

    return list(rows)
