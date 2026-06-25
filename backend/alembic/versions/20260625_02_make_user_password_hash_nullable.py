"""Make user password_hash nullable for Google auth.

Revision ID: 20260625_02_make_user_password_hash_nullable
Revises: 20260625_01_add_choices_history
Create Date: 2026-06-25 12:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260625_02_make_user_password_hash_nullable"
down_revision = "20260625_01_add_choices_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "password_hash",
            existing_type=sa.String(length=255),
            nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "password_hash",
            existing_type=sa.String(length=255),
            nullable=False,
        )
