from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def generate_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    credit_balance: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    payments: Mapped[list["Payment"]] = relationship(back_populates="user")
    credit_transactions: Mapped[list["CreditTransaction"]] = relationship(
        back_populates="user"
    )
    generations: Mapped[list["Generation"]] = relationship(back_populates="user")


class GuestSession(Base):
    __tablename__ = "guest_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    session_token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    has_used_free_preview: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    generations: Mapped[list["Generation"]] = relationship(back_populates="guest_session")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    stripe_session_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plan_id: Mapped[str] = mapped_column(String(64))
    plan_name: Mapped[str] = mapped_column(String(120))
    credits: Mapped[int] = mapped_column(Integer)
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(12), default="usd")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    credits_granted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    user: Mapped["User"] = relationship(back_populates="payments")
    credit_transactions: Mapped[list["CreditTransaction"]] = relationship(
        back_populates="payment"
    )


class Generation(Base):
    __tablename__ = "generations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    guest_session_id: Mapped[str | None] = mapped_column(
        ForeignKey("guest_sessions.id"), nullable=True, index=True
    )
    source_generation_id: Mapped[str | None] = mapped_column(
        ForeignKey("generations.id"), nullable=True, index=True
    )
    target_surface: Mapped[str] = mapped_column(String(120))
    requested_change: Mapped[str] = mapped_column(String(255))
    final_prompt: Mapped[str] = mapped_column(Text)
    before_image_key: Mapped[str] = mapped_column(String(500))
    before_image_content_type: Mapped[str] = mapped_column(String(120))
    after_image_key: Mapped[str] = mapped_column(String(500))
    after_image_content_type: Mapped[str] = mapped_column(String(120))
    quality_mode: Mapped[str] = mapped_column(String(32))
    watermarked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_free_preview: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    user: Mapped["User | None"] = relationship(back_populates="generations")
    guest_session: Mapped["GuestSession | None"] = relationship(back_populates="generations")
    credit_transactions: Mapped[list["CreditTransaction"]] = relationship(
        back_populates="generation"
    )


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    payment_id: Mapped[str | None] = mapped_column(ForeignKey("payments.id"), nullable=True)
    generation_id: Mapped[str | None] = mapped_column(
        ForeignKey("generations.id"), nullable=True
    )
    delta: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(48))
    description: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    user: Mapped["User"] = relationship(back_populates="credit_transactions")
    payment: Mapped["Payment | None"] = relationship(back_populates="credit_transactions")
    generation: Mapped["Generation | None"] = relationship(back_populates="credit_transactions")
