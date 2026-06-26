"""Add login_id, name, and grade to users.

Revision ID: 20260624_01_add_user_login_id_name_grade
Revises: None
Create Date: 2026-06-24 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision = "20260624_01_add_user_login_id_name_grade"
down_revision = None
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def _table_columns(bind, table_name: str) -> set[str]:
    inspector = inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _ensure_login_ids(bind) -> None:
    rows = bind.execute(
        text("SELECT id, login_id, name, email FROM users ORDER BY id")
    ).fetchall()
    used_login_ids: set[str] = set()

    for user_id, login_id, name, email in rows:
        candidate = (login_id or "").strip()
        if not candidate or candidate in used_login_ids:
            base = ""
            if email:
                base = email.split("@", 1)[0].strip()
            if not base and name:
                base = name.strip()
            if not base:
                base = f"user{user_id}"

            candidate = base
            suffix = 1
            while candidate in used_login_ids:
                suffix += 1
                candidate = f"{base}_{suffix}"

        used_login_ids.add(candidate)
        bind.execute(
            text("UPDATE users SET login_id = :login_id WHERE id = :user_id"),
            {"login_id": candidate, "user_id": user_id},
        )


def upgrade() -> None:
    bind = op.get_bind()
    if not _table_exists(bind, "users"):
        return

    columns = _table_columns(bind, "users")

    if "username" in columns and "name" not in columns:
        op.execute(text("ALTER TABLE users RENAME COLUMN username TO name"))
        columns.discard("username")
        columns.add("name")

    if "name" not in columns:
        op.add_column(
            "users",
            sa.Column("name", sa.String(length=100), nullable=True),
        )
        columns.add("name")

    if "login_id" not in columns:
        op.add_column(
            "users",
            sa.Column("login_id", sa.String(length=50), nullable=True),
        )
        columns.add("login_id")

    if "auth_provider" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "auth_provider",
                sa.Enum("local", "google", name="authprovider", native_enum=False, length=20),
                nullable=False,
                server_default="local",
            ),
        )
        columns.add("auth_provider")

    if "provider_user_id" not in columns:
        op.add_column(
            "users",
            sa.Column("provider_user_id", sa.String(length=255), nullable=True),
        )
        columns.add("provider_user_id")

    if "grade" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "grade",
                sa.Enum("student", "teacher", name="usergrade", native_enum=False, length=20),
                nullable=False,
                server_default="student",
            ),
        )
        columns.add("grade")

    if bind.dialect.name == "postgresql":
        bind.execute(
            text(
                """
                UPDATE users
                SET name = CASE
                    WHEN name IS NOT NULL AND TRIM(name) <> '' THEN name
                    WHEN nickname IS NOT NULL AND TRIM(nickname) <> '' THEN nickname
                    WHEN email IS NOT NULL AND strpos(email, '@') > 1 THEN substr(email, 1, strpos(email, '@') - 1)
                    ELSE 'user' || id
                END
                """
            )
        )
    else:
        bind.execute(
            text(
                """
                UPDATE users
                SET name = CASE
                    WHEN name IS NOT NULL AND TRIM(name) <> '' THEN name
                    WHEN nickname IS NOT NULL AND TRIM(nickname) <> '' THEN nickname
                    WHEN email IS NOT NULL AND INSTR(email, '@') > 1 THEN SUBSTR(email, 1, INSTR(email, '@') - 1)
                    ELSE 'user' || id
                END
                """
            )
        )
    _ensure_login_ids(bind)
    bind.execute(
        text("UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL OR TRIM(auth_provider) = ''")
    )
    bind.execute(text("UPDATE users SET grade = 'student' WHERE grade IS NULL OR TRIM(grade) = ''"))
    bind.execute(text("DROP INDEX IF EXISTS ix_users_username"))
    bind.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_login_id ON users (login_id)"
        )
    )
    bind.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_provider_user_id "
            "ON users (auth_provider, provider_user_id)"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    if not _table_exists(bind, "users"):
        return

    columns = _table_columns(bind, "users")

    if "login_id" in columns:
        op.execute(text("DROP INDEX IF EXISTS ix_users_login_id"))
        op.drop_column("users", "login_id")

    if "provider_user_id" in columns:
        op.execute(text("DROP INDEX IF EXISTS ix_users_provider_user_id"))
        op.drop_column("users", "provider_user_id")

    if "auth_provider" in columns:
        op.drop_column("users", "auth_provider")

    if "grade" in columns:
        op.drop_column("users", "grade")

    if "name" in columns and "username" not in columns:
        op.execute(text("ALTER TABLE users RENAME COLUMN name TO username"))
