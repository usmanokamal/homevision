"""Initial schema.

Revision ID: 20260421_01
Revises:
Create Date: 2026-04-21 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260421_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "guest_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("session_token", sa.String(length=128), nullable=False),
        sa.Column("has_used_free_preview", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_guest_sessions_session_token"),
        "guest_sessions",
        ["session_token"],
        unique=True,
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False),
        sa.Column("credit_balance", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "payments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("stripe_session_id", sa.String(length=255), nullable=False),
        sa.Column("stripe_payment_intent_id", sa.String(length=255), nullable=True),
        sa.Column("plan_id", sa.String(length=64), nullable=False),
        sa.Column("plan_name", sa.String(length=120), nullable=False),
        sa.Column("credits", sa.Integer(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=12), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("credits_granted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_payments_stripe_session_id"), "payments", ["stripe_session_id"], unique=True)
    op.create_index(op.f("ix_payments_user_id"), "payments", ["user_id"], unique=False)

    op.create_table(
        "generations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("guest_session_id", sa.String(length=36), nullable=True),
        sa.Column("source_generation_id", sa.String(length=36), nullable=True),
        sa.Column("target_surface", sa.String(length=120), nullable=False),
        sa.Column("requested_change", sa.String(length=255), nullable=False),
        sa.Column("final_prompt", sa.Text(), nullable=False),
        sa.Column("before_image_key", sa.String(length=500), nullable=False),
        sa.Column("before_image_content_type", sa.String(length=120), nullable=False),
        sa.Column("after_image_key", sa.String(length=500), nullable=False),
        sa.Column("after_image_content_type", sa.String(length=120), nullable=False),
        sa.Column("quality_mode", sa.String(length=32), nullable=False),
        sa.Column("watermarked", sa.Boolean(), nullable=False),
        sa.Column("is_free_preview", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["guest_session_id"], ["guest_sessions.id"]),
        sa.ForeignKeyConstraint(["source_generation_id"], ["generations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_generations_guest_session_id"), "generations", ["guest_session_id"], unique=False)
    op.create_index(op.f("ix_generations_source_generation_id"), "generations", ["source_generation_id"], unique=False)
    op.create_index(op.f("ix_generations_user_id"), "generations", ["user_id"], unique=False)

    op.create_table(
        "credit_transactions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("payment_id", sa.String(length=36), nullable=True),
        sa.Column("generation_id", sa.String(length=36), nullable=True),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=48), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["generation_id"], ["generations.id"]),
        sa.ForeignKeyConstraint(["payment_id"], ["payments.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_credit_transactions_user_id"), "credit_transactions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_credit_transactions_user_id"), table_name="credit_transactions")
    op.drop_table("credit_transactions")

    op.drop_index(op.f("ix_generations_user_id"), table_name="generations")
    op.drop_index(op.f("ix_generations_source_generation_id"), table_name="generations")
    op.drop_index(op.f("ix_generations_guest_session_id"), table_name="generations")
    op.drop_table("generations")

    op.drop_index(op.f("ix_payments_user_id"), table_name="payments")
    op.drop_index(op.f("ix_payments_stripe_session_id"), table_name="payments")
    op.drop_table("payments")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    op.drop_index(op.f("ix_guest_sessions_session_token"), table_name="guest_sessions")
    op.drop_table("guest_sessions")
