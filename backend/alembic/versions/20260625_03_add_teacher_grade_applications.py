"""Add teacher_grade_applications table.

Revision ID: 20260625_03_add_teacher_grade_applications
Revises: 20260625_02_make_user_password_hash_nullable
Create Date: 2026-06-25 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260625_03_add_teacher_grade_applications"
down_revision = "20260625_02_make_user_password_hash_nullable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "teacher_grade_applications" in inspect(bind).get_table_names():
        return

    op.create_table(
        "teacher_grade_applications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("school_name", sa.String(length=200), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="teachergradeapplicationstatus", native_enum=False, length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reviewer_admin_id", sa.Integer(), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["reviewer_admin_id"], ["admins.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_teacher_grade_applications_user_id"),
        "teacher_grade_applications",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_teacher_grade_applications_user_id"), table_name="teacher_grade_applications")
    op.drop_table("teacher_grade_applications")
