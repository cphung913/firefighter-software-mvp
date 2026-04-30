"""incident sequence counter per department

Revision ID: d1e8f3c92a47
Revises: c3f7a9b24d01
Create Date: 2026-04-29 00:00:00.000000

Adds incident_seq integer column to departments for per-department NFIRS-style
incident number generation (YYYY-NNNNNN). Default 0.
"""
from alembic import op
import sqlalchemy as sa

revision = "d1e8f3c92a47"
down_revision = "c3f7a9b24d01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "departments",
        sa.Column(
            "incident_seq",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("departments", "incident_seq")
