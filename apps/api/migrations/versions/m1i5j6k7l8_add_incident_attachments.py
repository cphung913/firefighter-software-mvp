"""add incident_attachments table

Revision ID: m1i5j6k7l8
Revises: l0h4i5j6k7
Create Date: 2026-05-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m1i5j6k7l8"
down_revision: Union[str, Sequence[str], None] = "l0h4i5j6k7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "incident_attachments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("incident_id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("file_type", sa.String(length=32), nullable=False),
        sa.Column("original_filename", sa.String(length=256), nullable=True),
        sa.Column("file_ref", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("caption", sa.String(length=512), nullable=True),
        sa.Column("uploaded_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_incident_attachments_incident_id",
        "incident_attachments",
        ["incident_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_incident_attachments_incident_id", table_name="incident_attachments")
    op.drop_table("incident_attachments")
