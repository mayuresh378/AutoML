"""add firebase_uid and profile columns to users

Revision ID: 002
Revises: 001
Create Date: 2026-09-03
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    try:
        op.add_column("users", sa.Column("firebase_uid", sa.String(), nullable=True))
        op.create_index(op.f("ix_users_firebase_uid"), "users", ["firebase_uid"], unique=True)
    except Exception:
        pass

    try:
        op.add_column("users", sa.Column("profile_picture", sa.String(), nullable=True))
    except Exception:
        pass

    try:
        op.add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))
    except Exception:
        pass

    try:
        op.alter_column("users", "password_hash", existing_type=sa.String(), nullable=True)
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index(op.f("ix_users_firebase_uid"), table_name="users")
        op.drop_column("users", "firebase_uid")
        op.drop_column("users", "profile_picture")
        op.drop_column("users", "last_login_at")
    except Exception:
        pass
