"""mvp schema cleanup

Revision ID: c3f7a9b24d01
Revises: b5fcfa402021
Create Date: 2026-04-28 00:00:00.000000

Drops non-MVP tables (checklists, PPE, SCBA).
Adds missing NERIS fields to incidents.
Adds voice_sessions and voice_logs tables.
Fixes apparatus service_status default.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3f7a9b24d01"
down_revision: Union[str, Sequence[str], None] = "b5fcfa402021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Drop non-MVP tables ---
    op.drop_table("checklist_completions")
    op.drop_table("checklist_templates")
    op.drop_table("ppe_items")
    op.drop_table("scba_units")

    # --- Add missing NERIS fields to incidents ---
    op.add_column("incidents", sa.Column("dispatch_time", sa.DateTime(timezone=True), nullable=True))
    op.add_column("incidents", sa.Column("en_route_time", sa.DateTime(timezone=True), nullable=True))
    op.add_column("incidents", sa.Column("controlled_time", sa.DateTime(timezone=True), nullable=True))
    op.add_column("incidents", sa.Column("units_responding", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"))
    op.add_column("incidents", sa.Column("personnel_on_scene", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"))
    op.add_column("incidents", sa.Column("casualty_civilian", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("incidents", sa.Column("casualty_ff", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("incidents", sa.Column("actions_taken", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"))
    op.add_column("incidents", sa.Column("property_use", sa.String(length=64), nullable=True))
    op.add_column("incidents", sa.Column("sync_status", sa.String(length=32), nullable=False, server_default="pending"))

    # --- Fix apparatus service_status default ---
    op.alter_column("apparatus", "service_status", server_default="available")

    # --- Create voice_sessions ---
    op.create_table(
        "voice_sessions",
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("session_code", sa.String(length=8), nullable=False),
        sa.Column("started_by", sa.UUID(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["started_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_voice_sessions_session_code"), "voice_sessions", ["session_code"], unique=False)

    # --- Create voice_logs ---
    op.create_table(
        "voice_logs",
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("recorded_by", sa.UUID(), nullable=True),
        sa.Column("entry_type", sa.String(length=32), nullable=True),
        sa.Column("audio_ref", sa.Text(), nullable=True),
        sa.Column("raw_transcript", sa.Text(), nullable=True),
        sa.Column("ai_extracted", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("review_status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("sync_status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["voice_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recorded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_voice_logs_session_id"), "voice_logs", ["session_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_voice_logs_session_id"), table_name="voice_logs")
    op.drop_table("voice_logs")
    op.drop_index(op.f("ix_voice_sessions_session_code"), table_name="voice_sessions")
    op.drop_table("voice_sessions")

    op.drop_column("incidents", "sync_status")
    op.drop_column("incidents", "property_use")
    op.drop_column("incidents", "actions_taken")
    op.drop_column("incidents", "casualty_ff")
    op.drop_column("incidents", "casualty_civilian")
    op.drop_column("incidents", "personnel_on_scene")
    op.drop_column("incidents", "units_responding")
    op.drop_column("incidents", "controlled_time")
    op.drop_column("incidents", "en_route_time")
    op.drop_column("incidents", "dispatch_time")

    # Recreate dropped tables (downgrade restores them as empty)
    op.create_table(
        "checklist_templates",
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("items", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "checklist_completions",
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("local_id", sa.String(length=64), nullable=True),
        sa.Column("template_id", sa.UUID(), nullable=True),
        sa.Column("apparatus_id", sa.UUID(), nullable=True),
        sa.Column("completed_by", sa.UUID(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("responses", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["apparatus_id"], ["apparatus.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["completed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["checklist_templates.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("department_id", "local_id", name="uq_checklist_completions_dept_local"),
    )
    op.create_table(
        "ppe_items",
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("local_id", sa.String(length=64), nullable=True),
        sa.Column("item_type", sa.String(length=32), nullable=False),
        sa.Column("serial_number", sa.String(length=64), nullable=True),
        sa.Column("assigned_to", sa.UUID(), nullable=True),
        sa.Column("manufacture_date", sa.Date(), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("last_inspection", sa.Date(), nullable=True),
        sa.Column("retired_at", sa.Date(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("department_id", "local_id", name="uq_ppe_items_dept_local"),
    )
    op.create_table(
        "scba_units",
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("local_id", sa.String(length=64), nullable=True),
        sa.Column("serial_number", sa.String(length=64), nullable=True),
        sa.Column("manufacturer", sa.String(length=64), nullable=True),
        sa.Column("assigned_to", sa.UUID(), nullable=True),
        sa.Column("cylinder_hydro_date", sa.Date(), nullable=True),
        sa.Column("regulator_service_date", sa.Date(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("department_id", "local_id", name="uq_scba_units_dept_local"),
    )
