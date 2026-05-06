"""add preplans table

Revision ID: l0h4i5j6k7
Revises: k9g3h4i5j6
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "l0h4i5j6k7"
down_revision: Union[str, Sequence[str], None] = "k9g3h4i5j6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "preplans",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("address", sa.String(length=512), nullable=False),
        sa.Column("address_normalized", sa.String(length=512), nullable=True),
        sa.Column("building_type", sa.String(length=64), nullable=True),
        sa.Column("floors_above", sa.Integer(), nullable=True),
        sa.Column("floors_below", sa.Integer(), nullable=True),
        sa.Column("occupancy_load", sa.Integer(), nullable=True),
        sa.Column("construction_type", sa.String(length=64), nullable=True),
        sa.Column(
            "hazards",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "water_supply",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("access_notes", sa.Text(), nullable=True),
        sa.Column("tactical_notes", sa.Text(), nullable=True),
        sa.Column(
            "floor_plan_refs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("location_lat", sa.Float(), nullable=True),
        sa.Column("location_lng", sa.Float(), nullable=True),
        sa.Column(
            "raw_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_preplans_dept_address", "preplans", ["department_id", "address"])


def downgrade() -> None:
    op.drop_index("ix_preplans_dept_address", table_name="preplans")
    op.drop_table("preplans")
