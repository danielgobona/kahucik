"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nickname", sa.String(40), nullable=False),
        sa.Column("nickname_normalized", sa.String(40), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("email_normalized", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("locale", sa.String(8), nullable=False, server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_users_nickname", "users", ["nickname"], unique=True)
    op.create_index("ix_users_nickname_normalized", "users", ["nickname_normalized"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_email_normalized", "users", ["email_normalized"], unique=True)

    op.create_table(
        "session_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("csrf_token", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_session_tokens_user_id", "session_tokens", ["user_id"])
    op.create_index("ix_session_tokens_token_hash", "session_tokens", ["token_hash"], unique=True)
    op.create_index("ix_session_tokens_expires_at", "session_tokens", ["expires_at"])

    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("storage_key", sa.String(512), nullable=False, unique=True),
        sa.Column("content_type", sa.String(64), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_media_assets_owner_id", "media_assets", ["owner_id"])

    op.execute("DO $$ BEGIN CREATE TYPE quizstatus AS ENUM ('draft', 'published', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE questiontype AS ENUM ('quiz', 'true_false', 'multi_select', 'puzzle'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute(
        "DO $$ BEGIN CREATE TYPE gamestatus AS ENUM ("
        "'lobby', 'countdown', 'question_active', 'question_reveal', "
        "'leaderboard', 'finished', 'cancelled'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    quiz_status = postgresql.ENUM(
        "draft", "published", "archived", name="quizstatus", create_type=False
    )
    question_type = postgresql.ENUM(
        "quiz", "true_false", "multi_select", "puzzle", name="questiontype", create_type=False
    )
    game_status = postgresql.ENUM(
        "lobby",
        "countdown",
        "question_active",
        "question_reveal",
        "leaderboard",
        "finished",
        "cancelled",
        name="gamestatus",
        create_type=False,
    )

    op.create_table(
        "quizzes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", quiz_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_quizzes_owner_id", "quizzes", ["owner_id"])
    op.create_index("ix_quizzes_status", "quizzes", ["status"])

    op.create_table(
        "questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("quiz_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quizzes.id", ondelete="CASCADE")),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("type", question_type, nullable=False),
        sa.Column("text", sa.String(240), nullable=False),
        sa.Column("timer_seconds", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("image_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_questions_quiz_id", "questions", ["quiz_id"])

    op.create_table(
        "question_options",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("questions.id", ondelete="CASCADE")),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("text", sa.String(120), nullable=False, server_default=""),
        sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("correct_order", sa.Integer(), nullable=True),
        sa.Column("image_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_question_options_question_id", "question_options", ["question_id"])

    op.create_table(
        "games",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("quiz_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quizzes.id", ondelete="RESTRICT")),
        sa.Column("host_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("code", sa.String(8), nullable=False),
        sa.Column("status", game_status, nullable=False),
        sa.Column("current_question_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quiz_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_games_quiz_id", "games", ["quiz_id"])
    op.create_index("ix_games_host_id", "games", ["host_id"])
    op.create_index("ix_games_code", "games", ["code"], unique=True)
    op.create_index("ix_games_status", "games", ["status"])

    op.create_table(
        "game_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("games.id", ondelete="CASCADE")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("nickname", sa.String(40), nullable=False),
        sa.Column("nickname_normalized", sa.String(40), nullable=False),
        sa.Column("is_guest", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("reconnect_token_hash", sa.String(128), nullable=False),
        sa.Column("join_order", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_response_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("answers_correct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("answers_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("connected", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("present_at_question_start", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("game_id", "nickname_normalized", name="uq_game_nickname"),
    )
    op.create_index("ix_game_participants_game_id", "game_participants", ["game_id"])
    op.create_index("ix_game_participants_user_id", "game_participants", ["user_id"])
    op.create_index(
        "ix_game_participants_reconnect_token_hash",
        "game_participants",
        ["reconnect_token_hash"],
        unique=True,
    )

    op.create_table(
        "submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("games.id", ondelete="CASCADE")),
        sa.Column("participant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("game_participants.id", ondelete="CASCADE")),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("points_awarded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("response_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("game_id", "participant_id", "question_id", name="uq_submission_once"),
    )
    op.create_index("ix_submissions_game_id", "submissions", ["game_id"])
    op.create_index("ix_submissions_participant_id", "submissions", ["participant_id"])
    op.create_index("ix_submissions_question_id", "submissions", ["question_id"])

    op.create_table(
        "game_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("games.id", ondelete="CASCADE")),
        sa.Column("participant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("game_participants.id", ondelete="CASCADE")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("nickname", sa.String(40), nullable=False),
        sa.Column("is_guest", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("answers_correct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("answers_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_response_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("game_id", "participant_id", name="uq_game_result"),
    )
    op.create_index("ix_game_results_game_id", "game_results", ["game_id"])
    op.create_index("ix_game_results_participant_id", "game_results", ["participant_id"])
    op.create_index("ix_game_results_user_id", "game_results", ["user_id"])


def downgrade() -> None:
    op.drop_table("game_results")
    op.drop_table("submissions")
    op.drop_table("game_participants")
    op.drop_table("games")
    op.drop_table("question_options")
    op.drop_table("questions")
    op.drop_table("quizzes")
    op.drop_table("media_assets")
    op.drop_table("session_tokens")
    op.drop_table("users")
    sa.Enum(name="gamestatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="questiontype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="quizstatus").drop(op.get_bind(), checkfirst=True)
