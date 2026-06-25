"""Add classes and class_memberships tables.

Revision ID: 20260625_05_add_classes
Revises: 20260625_04_add_user_deleted_at
Create Date: 2026-06-25 00:00:00.000000

classes.entry_code: 연도 접두사 포함 최대 16자 → 컬럼 길이 20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260625_05_add_classes"
down_revision = "20260625_04_add_user_deleted_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    table_names = set(inspect(bind).get_table_names())

    if "classes" not in table_names:
        op.create_table(
            "classes",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("teacher_user_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("entry_code", sa.String(length=20), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["teacher_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("entry_code"),
        )
        op.create_index(op.f("ix_classes_teacher_user_id"), "classes", ["teacher_user_id"], unique=False)
        op.create_index(op.f("ix_classes_entry_code"), "classes", ["entry_code"], unique=False)

    if "class_memberships" not in table_names:
        op.create_table(
            "class_memberships",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("class_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("joined_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("class_id", "user_id", name="uq_class_memberships_class_user"),
        )
        op.create_index(op.f("ix_class_memberships_class_id"), "class_memberships", ["class_id"], unique=False)
        op.create_index(op.f("ix_class_memberships_user_id"), "class_memberships", ["user_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    table_names = set(inspect(bind).get_table_names())

    if "class_memberships" in table_names:
        op.drop_index(op.f("ix_class_memberships_user_id"), table_name="class_memberships")
        op.drop_index(op.f("ix_class_memberships_class_id"), table_name="class_memberships")
        op.drop_table("class_memberships")

    if "classes" in table_names:
        op.drop_index(op.f("ix_classes_entry_code"), table_name="classes")
        op.drop_index(op.f("ix_classes_teacher_user_id"), table_name="classes")
        op.drop_table("classes")
