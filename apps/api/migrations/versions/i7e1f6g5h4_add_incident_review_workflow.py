"""add_incident_review_workflow

Revision ID: i7e1f6g5h4
Revises: h6d0e5f4a3b2
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i7e1f6g5h4"
down_revision: Union[str, Sequence[str], None] = "h6d0e5f4a3b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "incidents",
        sa.Column(
            "report_status",
            sa.String(length=32),
            nullable=False,
            server_default="draft",
        ),
    )
    op.add_column(
        "incidents",
        sa.Column("reviewed_by", sa.UUID(), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("review_notes", sa.Text(), nullable=True),
    )
    op.create_foreign_key(
        "fk_incidents_reviewed_by_users",
        "incidents",
        "users",
        ["reviewed_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_incidents_reviewed_by_users", "incidents", type_="foreignkey")
    op.drop_column("incidents", "review_notes")
    op.drop_column("incidents", "reviewed_at")
    op.drop_column("incidents", "reviewed_by")
    op.drop_column("incidents", "report_status")
