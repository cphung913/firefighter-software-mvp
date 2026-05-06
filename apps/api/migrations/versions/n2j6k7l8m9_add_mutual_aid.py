"""add mutual aid agencies and assignments

Revision ID: n2j6k7l8m9
Revises: m1i5j6k7l8
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "n2j6k7l8m9"
down_revision: Union[str, Sequence[str], None] = "m1i5j6k7l8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mutual_aid_agencies",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("agency_type", sa.String(length=64), nullable=True),
        sa.Column("contact_name", sa.String(length=256), nullable=True),
        sa.Column("contact_phone", sa.String(length=32), nullable=True),
        sa.Column("radio_channel", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_mutual_aid_agencies_department_id",
        "mutual_aid_agencies",
        ["department_id"],
        unique=False,
    )

    op.create_table(
        "mutual_aid_assignments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("incident_id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("agency_id", sa.UUID(), nullable=True),
        sa.Column("agency_name_override", sa.String(length=256), nullable=True),
        sa.Column("units_assigned", sa.String(length=512), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("assigned_by", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(["agency_id"], ["mutual_aid_agencies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_mutual_aid_assignments_incident_id",
        "mutual_aid_assignments",
        ["incident_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_mutual_aid_assignments_incident_id", table_name="mutual_aid_assignments")
    op.drop_table("mutual_aid_assignments")
    op.drop_index("ix_mutual_aid_agencies_department_id", table_name="mutual_aid_agencies")
    op.drop_table("mutual_aid_agencies")
