"""add scheduling and training tables

Revision ID: g4b8c3d5e2f1
Revises: f3a7b2c9d1e5
Create Date: 2026-05-05 00:00:00.000000

Adds shift_patterns, shift_groups, shift_assignments, leave_requests, shift_trades,
training_drills, training_attendees, and certifications tables.
Also adds minimum_staffing and overtime_threshold_hours to departments.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g4b8c3d5e2f1"
down_revision: Union[str, Sequence[str], None] = "f3a7b2c9d1e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- departments: add staffing config columns ---
    op.add_column("departments", sa.Column("minimum_staffing", sa.Integer(), nullable=True))
    op.add_column(
        "departments",
        sa.Column("overtime_threshold_hours", sa.Numeric(6, 2), nullable=True),
    )

    # --- shift_patterns ---
    op.create_table(
        "shift_patterns",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("pattern_type", sa.String(length=32), nullable=False, server_default="48_96"),
        sa.Column("cycle_length_days", sa.Integer(), nullable=False, server_default="6"),
        sa.Column("on_days", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("off_days", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("kelly_day_interval", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shift_patterns_dept", "shift_patterns", ["department_id"])

    # --- shift_groups ---
    op.create_table(
        "shift_groups",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("pattern_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("color", sa.String(length=16), nullable=False, server_default="#3b82f6"),
        sa.Column("cycle_offset_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pattern_id"], ["shift_patterns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shift_groups_dept", "shift_groups", ["department_id"])
    op.create_index("ix_shift_groups_pattern", "shift_groups", ["pattern_id"])

    # --- shift_assignments ---
    op.create_table(
        "shift_assignments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["shift_groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shift_assignments_dept", "shift_assignments", ["department_id"])
    op.create_index("ix_shift_assignments_user", "shift_assignments", ["user_id"])
    op.create_index("ix_shift_assignments_group", "shift_assignments", ["group_id"])

    # --- leave_requests ---
    op.create_table(
        "leave_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("leave_type", sa.String(length=32), nullable=False, server_default="vacation"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("reviewed_by", sa.UUID(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_leave_requests_dept", "leave_requests", ["department_id"])
    op.create_index("ix_leave_requests_user", "leave_requests", ["user_id"])
    op.create_index("ix_leave_requests_dates", "leave_requests", ["department_id", "start_date", "end_date"])

    # --- shift_trades ---
    op.create_table(
        "shift_trades",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("requester_id", sa.UUID(), nullable=False),
        sa.Column("recipient_id", sa.UUID(), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("return_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("approved_by", sa.UUID(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shift_trades_dept", "shift_trades", ["department_id"])
    op.create_index("ix_shift_trades_requester", "shift_trades", ["requester_id"])
    op.create_index("ix_shift_trades_recipient", "shift_trades", ["recipient_id"])

    # --- training_drills ---
    op.create_table(
        "training_drills",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("drill_type", sa.String(length=64), nullable=False, server_default="other"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("drill_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("hours", sa.Numeric(5, 2), nullable=False, server_default="1.0"),
        sa.Column("instructor", sa.String(length=128), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("iso_category", sa.String(length=32), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_training_drills_dept", "training_drills", ["department_id"])
    op.create_index("ix_training_drills_date", "training_drills", ["department_id", "drill_date"])

    # --- training_attendees ---
    op.create_table(
        "training_attendees",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("drill_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["drill_id"], ["training_drills.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("drill_id", "user_id", name="uq_training_attendee_drill_user"),
    )
    op.create_index("ix_training_attendees_drill", "training_attendees", ["drill_id"])
    op.create_index("ix_training_attendees_user", "training_attendees", ["user_id"])

    # --- certifications ---
    op.create_table(
        "certifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("cert_type", sa.String(length=64), nullable=False),
        sa.Column("cert_number", sa.String(length=64), nullable=True),
        sa.Column("issuing_body", sa.String(length=128), nullable=True),
        sa.Column("issued_date", sa.Date(), nullable=False),
        sa.Column("expiry_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("document_ref", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_certifications_dept", "certifications", ["department_id"])
    op.create_index("ix_certifications_user", "certifications", ["user_id"])
    op.create_index("ix_certifications_expiry", "certifications", ["department_id", "expiry_date"])


def downgrade() -> None:
    op.drop_table("certifications")
    op.drop_table("training_attendees")
    op.drop_table("training_drills")
    op.drop_table("shift_trades")
    op.drop_table("leave_requests")
    op.drop_table("shift_assignments")
    op.drop_table("shift_groups")
    op.drop_table("shift_patterns")
    op.drop_column("departments", "overtime_threshold_hours")
    op.drop_column("departments", "minimum_staffing")
