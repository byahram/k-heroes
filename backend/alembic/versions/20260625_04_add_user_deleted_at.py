"""Add deleted_at to users table.

Revision ID: 20260625_04_add_user_deleted_at
Revises: 20260625_03_add_teacher_grade_applications
Create Date: 2026-06-25 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260625_04_add_user_deleted_at"
down_revision = "20260625_03_add_teacher_grade_applications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "deleted_at" in {column["name"] for column in inspect(bind).get_columns("users")}:
        return

    op.add_column("users", sa.Column("deleted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if "deleted_at" not in {column["name"] for column in inspect(bind).get_columns("users")}:
        return

    op.drop_column("users", "deleted_at")
