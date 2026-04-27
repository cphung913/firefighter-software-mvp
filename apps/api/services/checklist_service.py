import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.apparatus import Apparatus
from models.checklist import ChecklistTemplate

DEFAULT_APPARATUS = [
    {
        "local_id": "seed_engine_1",
        "unit_id": "Engine 1",
        "type": "Engine",
        "year": 2018,
        "make": "Pierce",
        "model": "Enforcer",
        "vin": "4P1CT01N4JA000101",
        "service_status": "in_service",
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
        "service_status": "in_service",
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
        "service_status": "in_service",
        "mileage": 9870,
    },
]

DEFAULT_TEMPLATE = {
    "name": "Daily apparatus readiness",
    "type": "apparatus_daily",
    "items": [
        {
            "id": "cab_radios",
            "label": "Cab clean, mobile radios powered, and MDT online",
            "description": "Confirm driver controls, radio head, and charger cables are ready.",
        },
        {
            "id": "engine_fluids",
            "label": "Engine oil, coolant, and fuel levels checked",
            "description": "Note leaks or any fluid below ready-to-run levels.",
        },
        {
            "id": "pump_panel",
            "label": "Pump panel, caps, and hose beds secured",
            "description": "Make sure intakes, discharges, and hose loads are scene-ready.",
        },
        {
            "id": "medical_gear",
            "label": "AED, first-in bag, and airway kit accounted for",
            "description": "Replace missing seals or expired consumables before the next call.",
        },
        {
            "id": "scba_supply",
            "label": "SCBA cylinders full and spare bottles seated",
            "description": "Verify brackets, straps, and pressure are good to go.",
        },
        {
            "id": "lights_tools",
            "label": "Scene lights, hand tools, and forcible entry set present",
            "description": "Quick visual confirmation for common grab-and-go equipment.",
        },
        {
            "id": "tires_chocks",
            "label": "Tires, wheel chocks, and backing camera inspected",
            "description": "Catch obvious wear, flats, or missing safety gear before roll-out.",
        },
    ],
}


async def get_checklist_bootstrap(
    db: AsyncSession,
    *,
    department_id: uuid.UUID,
) -> tuple[list[ChecklistTemplate], list[Apparatus]]:
    created_seed_data = False

    apparatus = await db.scalars(
        select(Apparatus)
        .where(Apparatus.department_id == department_id)
        .order_by(Apparatus.unit_id)
    )
    apparatus_rows = apparatus.all()
    if not apparatus_rows:
        for seed in DEFAULT_APPARATUS:
            db.add(Apparatus(department_id=department_id, **seed))
        created_seed_data = True

    templates = await db.scalars(
        select(ChecklistTemplate)
        .where(ChecklistTemplate.department_id == department_id)
        .order_by(ChecklistTemplate.name)
    )
    template_rows = templates.all()
    if not template_rows:
        db.add(ChecklistTemplate(department_id=department_id, **DEFAULT_TEMPLATE))
        created_seed_data = True

    if created_seed_data:
        await db.commit()

    templates = await db.scalars(
        select(ChecklistTemplate)
        .where(ChecklistTemplate.department_id == department_id)
        .order_by(ChecklistTemplate.name)
    )
    apparatus = await db.scalars(
        select(Apparatus)
        .where(Apparatus.department_id == department_id)
        .order_by(Apparatus.unit_id)
    )
    return templates.all(), apparatus.all()
