"""add training_runs table

Revision ID: 003
Revises: 002
Create Date: 2026-10-12
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    try:
        op.create_table(
            "training_runs",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(), nullable=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=True),
            sa.Column("dataset_id", sa.String(), nullable=True),
            sa.Column("dataset_name", sa.String(), nullable=False),
            sa.Column("dataset_fingerprint", sa.String(), nullable=True),
            sa.Column("target_column", sa.String(), nullable=False),
            sa.Column("task_type", sa.String(), nullable=False, server_default="classification"),
            sa.Column("selected_algorithms", sa.JSON(), nullable=True),
            sa.Column("hyperparameters_config", sa.JSON(), nullable=True),
            sa.Column("preprocessing_config", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="queued"),
            sa.Column("progress", sa.Float(), server_default="0.0"),
            sa.Column("current_step", sa.String(), nullable=True),
            sa.Column("message", sa.String(), nullable=True),
            sa.Column("start_time", sa.DateTime(), nullable=True),
            sa.Column("end_time", sa.DateTime(), nullable=True),
            sa.Column("duration_seconds", sa.Float(), nullable=True),
            sa.Column("best_model_name", sa.String(), nullable=True),
            sa.Column("best_score", sa.Float(), nullable=True),
            sa.Column("rank_metric", sa.String(), nullable=True),
            sa.Column("evaluation_metrics", sa.JSON(), nullable=True),
            sa.Column("all_results", sa.JSON(), nullable=True),
            sa.Column("logs", sa.JSON(), nullable=True),
            sa.Column("error_type", sa.String(), nullable=True),
            sa.Column("error_details", sa.JSON(), nullable=True),
            sa.Column("model_artifact_path", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_training_runs_user_id"), "training_runs", ["user_id"])
        op.create_index(op.f("ix_training_runs_project_id"), "training_runs", ["project_id"])
        op.create_index(op.f("ix_training_runs_dataset_name"), "training_runs", ["dataset_name"])
        op.create_index(op.f("ix_training_runs_status"), "training_runs", ["status"])
        op.create_index(op.f("ix_training_runs_created_at"), "training_runs", ["created_at"])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_table("training_runs")
    except Exception:
        pass
