"""add_incident_priority

Revision ID: h6d0e5f4a3b2
Revises: g4b8c3d5e2f1
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h6d0e5f4a3b2"
down_revision: Union[str, Sequence[str], None] = "g4b8c3d5e2f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "incidents",
        sa.Column(
            "priority",
            sa.String(length=16),
            nullable=True,
            server_default=sa.text("'medium'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("incidents", "priority")
