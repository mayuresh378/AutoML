"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-07-10
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(), server_default="member"),
        sa.Column("is_active", sa.Boolean(), server_default="1"),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("preferences", sa.JSON(), nullable=True),
        sa.Column("mfa_enabled", sa.Boolean(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table("teams",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=True, unique=True),
        sa.Column("plan", sa.String(), server_default="free"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table("team_members",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("team_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(), server_default="member"),
        sa.Column("joined_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "team_id"),
    )

    op.create_table("api_keys",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("key_prefix", sa.String(length=8), nullable=False),
        sa.Column("key_hash", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default="active"),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table("experiments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("model", sa.String(), nullable=False),
        sa.Column("task_type", sa.String(), nullable=True),
        sa.Column("dataset", sa.String(), nullable=True),
        sa.Column("target", sa.String(), nullable=True),
        sa.Column("cv_score", sa.Float(), nullable=True),
        sa.Column("metrics", sa.JSON(), nullable=True),
        sa.Column("training_time", sa.Float(), nullable=True),
        sa.Column("total_time", sa.Float(), nullable=True),
        sa.Column("status", sa.String(), server_default="success"),
        sa.Column("params", sa.JSON(), nullable=True),
        sa.Column("feature_importance", sa.JSON(), nullable=True),
        sa.Column("confusion_matrix", sa.JSON(), nullable=True),
        sa.Column("run_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table("model_registry",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("experiment_id", sa.String(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("model_type", sa.String(), nullable=True),
        sa.Column("task_type", sa.String(), nullable=True),
        sa.Column("framework", sa.String(), server_default="sklearn"),
        sa.Column("file_path", sa.String(), nullable=True),
        sa.Column("file_size_kb", sa.Float(), nullable=True),
        sa.Column("cv_score", sa.Float(), nullable=True),
        sa.Column("metrics", sa.JSON(), nullable=True),
        sa.Column("params", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), server_default="staging"),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["experiment_id"], ["experiments.id"], ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table("deployments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("model_id", sa.String(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("endpoint_url", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default="active"),
        sa.Column("environment", sa.String(), server_default="production"),
        sa.Column("requests_count", sa.Integer(), server_default="0"),
        sa.Column("avg_latency_ms", sa.Float(), nullable=True),
        sa.Column("config", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["model_id"], ["model_registry.id"], ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table("pipelines",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("steps", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), server_default="draft"),
        sa.Column("schedule", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table("pipeline_runs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("pipeline_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default="pending"),
        sa.Column("current_step", sa.String(), nullable=True),
        sa.Column("results", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["pipeline_id"], ["pipelines.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table("webhooks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("events", sa.JSON(), nullable=True),
        sa.Column("secret", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default="active"),
        sa.Column("last_triggered_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table("audit_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("actor", sa.String(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("target", sa.String(), nullable=True),
        sa.Column("resource_type", sa.String(), nullable=True),
        sa.Column("resource_id", sa.String(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default="success"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("webhooks")
    op.drop_table("pipeline_runs")
    op.drop_table("pipelines")
    op.drop_table("deployments")
    op.drop_table("model_registry")
    op.drop_table("experiments")
    op.drop_table("api_keys")
    op.drop_table("team_members")
    op.drop_table("teams")
    op.drop_table("users")
