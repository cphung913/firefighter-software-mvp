"""add_incident_neris_export_tracking

Revision ID: k9g3h4i5j6
Revises: j8f2g3h4i5
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k9g3h4i5j6"
down_revision: Union[str, Sequence[str], None] = "j8f2g3h4i5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "incidents",
        sa.Column("neris_exported_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("incidents", "neris_exported_at")
