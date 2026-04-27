import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.ppe import PpeItem
from models.scba import ScbaUnit
from models.user import User
from services.checklist_service import get_checklist_bootstrap


def _days_ago(days: int) -> date:
    return date.today() - timedelta(days=days)


DEFAULT_PPE_SEED = [
    {
        "local_id": "seed_ppe_helmet_01",
        "item_type": "Helmet",
        "serial_number": "MSA-G1-H-014",
        "manufacture_date": _days_ago(365 * 4),
        "purchase_date": _days_ago(365 * 3),
        "last_inspection": _days_ago(340),
        "retired_at": None,
    },
    {
        "local_id": "seed_ppe_coat_01",
        "item_type": "Coat",
        "serial_number": "LION-VFORCE-C-221",
        "manufacture_date": _days_ago(365 * 6),
        "purchase_date": _days_ago(365 * 5),
        "last_inspection": _days_ago(395),
        "retired_at": None,
    },
    {
        "local_id": "seed_ppe_gloves_01",
        "item_type": "Gloves",
        "serial_number": "HEX-GL-077",
        "manufacture_date": _days_ago(365 * 2),
        "purchase_date": _days_ago(520),
        "last_inspection": _days_ago(110),
        "retired_at": None,
    },
]

DEFAULT_SCBA_SEED = [
    {
        "local_id": "seed_scba_01",
        "serial_number": "G1-450112",
        "manufacturer": "MSA",
        "cylinder_hydro_date": _days_ago(365 * 5 - 18),
        "regulator_service_date": _days_ago(340),
    },
    {
        "local_id": "seed_scba_02",
        "serial_number": "G1-450203",
        "manufacturer": "MSA",
        "cylinder_hydro_date": _days_ago(365 * 5 + 24),
        "regulator_service_date": _days_ago(400),
    },
    {
        "local_id": "seed_scba_03",
        "serial_number": "G1-450318",
        "manufacturer": "MSA",
        "cylinder_hydro_date": _days_ago(365 * 4),
        "regulator_service_date": _days_ago(150),
    },
]


async def get_assets_bootstrap(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
) -> tuple[list, list[PpeItem], list[ScbaUnit], list[User]]:
    _, apparatus = await get_checklist_bootstrap(db, department_id=department_id)
    roster = (
        await db.scalars(
            select(User).where(User.department_id == department_id).order_by(User.name)
        )
    ).all()

    primary_user_id = roster[0].id if roster else None
    secondary_user_id = roster[1].id if len(roster) > 1 else primary_user_id

    ppe_rows = (
        await db.scalars(
            select(PpeItem)
            .where(PpeItem.department_id == department_id)
            .order_by(PpeItem.item_type, PpeItem.serial_number)
        )
    ).all()
    scba_rows = (
        await db.scalars(
            select(ScbaUnit)
            .where(ScbaUnit.department_id == department_id)
            .order_by(ScbaUnit.serial_number)
        )
    ).all()

    created_seed_data = False

    if not ppe_rows:
        for index, seed in enumerate(DEFAULT_PPE_SEED):
            assigned_to = primary_user_id if index != 2 else secondary_user_id
            db.add(
                PpeItem(
                    department_id=department_id,
                    assigned_to=assigned_to,
                    **seed,
                )
            )
        created_seed_data = True

    if not scba_rows:
        for index, seed in enumerate(DEFAULT_SCBA_SEED):
            assigned_to = primary_user_id if index != 2 else secondary_user_id
            db.add(
                ScbaUnit(
                    department_id=department_id,
                    assigned_to=assigned_to,
                    **seed,
                )
            )
        created_seed_data = True

    if created_seed_data:
        await db.commit()

    ppe_rows = (
        await db.scalars(
            select(PpeItem)
            .where(PpeItem.department_id == department_id)
            .order_by(PpeItem.item_type, PpeItem.serial_number)
        )
    ).all()
    scba_rows = (
        await db.scalars(
            select(ScbaUnit)
            .where(ScbaUnit.department_id == department_id)
            .order_by(ScbaUnit.serial_number)
        )
    ).all()

    return apparatus, ppe_rows, scba_rows, roster
