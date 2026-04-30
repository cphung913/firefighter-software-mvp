"""voice_session: add extraction_status and extracted_fields columns

Revision ID: e2a4c6f8b1d3
Revises: d1e8f3c92a47
Create Date: 2026-04-29

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "e2a4c6f8b1d3"
down_revision = "d1e8f3c92a47"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "voice_sessions",
        sa.Column(
            "extraction_status",
            sa.String(32),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "voice_sessions",
        sa.Column("extracted_fields", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("voice_sessions", "extracted_fields")
    op.drop_column("voice_sessions", "extraction_status")
