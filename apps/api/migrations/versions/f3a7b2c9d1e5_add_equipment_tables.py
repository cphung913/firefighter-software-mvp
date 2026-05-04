"""add equipment tables

Revision ID: f3a7b2c9d1e5
Revises: e2a4c6f8b1d3
Create Date: 2026-05-04 00:00:00.000000

Adds equipment, equipment_inspections, and equipment_maintenance tables.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f3a7b2c9d1e5"
down_revision: Union[str, Sequence[str], None] = "e2a4c6f8b1d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "equipment",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("local_id", sa.String(length=64), nullable=True),
        sa.Column("equipment_type", sa.String(length=32), nullable=False, server_default="other"),
        sa.Column("identifier", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=128), nullable=True),
        sa.Column("manufacturer", sa.String(length=64), nullable=True),
        sa.Column("model", sa.String(length=64), nullable=True),
        sa.Column("year_manufactured", sa.Integer(), nullable=True),
        sa.Column("assigned_apparatus_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="in_service"),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("next_inspection_due", sa.Date(), nullable=True),
        sa.Column("last_inspection_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_apparatus_id"], ["apparatus.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("department_id", "local_id", name="uq_equipment_dept_local"),
    )
    op.create_index("ix_equipment_dept_type", "equipment", ["department_id", "equipment_type"])
    op.create_index("ix_equipment_next_due", "equipment", ["department_id", "next_inspection_due"])

    op.create_table(
        "equipment_inspections",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("local_id", sa.String(length=64), nullable=True),
        sa.Column("equipment_id", sa.UUID(), nullable=True),
        sa.Column("equipment_local_id", sa.String(length=64), nullable=True),
        sa.Column("inspection_type", sa.String(length=32), nullable=True),
        sa.Column("inspection_date", sa.Date(), nullable=True),
        sa.Column("passed", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("inspector_name", sa.String(length=128), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("next_due", sa.Date(), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["equipment_id"], ["equipment.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("department_id", "local_id", name="uq_equip_insp_dept_local"),
    )
    op.create_index("ix_equip_insp_equipment", "equipment_inspections", ["equipment_id", "inspection_date"])

    op.create_table(
        "equipment_maintenance",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("local_id", sa.String(length=64), nullable=True),
        sa.Column("equipment_id", sa.UUID(), nullable=True),
        sa.Column("equipment_local_id", sa.String(length=64), nullable=True),
        sa.Column("maintenance_type", sa.String(length=32), nullable=True),
        sa.Column("maintenance_date", sa.Date(), nullable=True),
        sa.Column("performed_by", sa.String(length=128), nullable=True),
        sa.Column("cost", sa.Numeric(10, 2), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("out_of_service_start", sa.Date(), nullable=True),
        sa.Column("out_of_service_end", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["equipment_id"], ["equipment.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("department_id", "local_id", name="uq_equip_maint_dept_local"),
    )
    op.create_index("ix_equip_maint_equipment", "equipment_maintenance", ["equipment_id", "maintenance_date"])


def downgrade() -> None:
    op.drop_table("equipment_maintenance")
    op.drop_table("equipment_inspections")
    op.drop_table("equipment")
