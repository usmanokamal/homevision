from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class CheckoutLinkRequest(BaseModel):
    plan_id: str


class RegenerateRequest(BaseModel):
    target: str | None = Field(default=None, max_length=120)
    change: str | None = Field(default=None, max_length=255)


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    is_admin: bool
    credit_balance: int
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserSummary


class PlanSummary(BaseModel):
    id: str
    name: str
    credits: int
    price_cents: int
    description: str
    featured: bool
    effective_price_per_credit_cents: float


class PaymentSummary(BaseModel):
    id: str
    plan_id: str
    plan_name: str
    credits: int
    amount_cents: int
    currency: str
    status: str
    created_at: datetime


class GenerationSummary(BaseModel):
    id: str
    target_surface: str
    requested_change: str
    final_prompt: str
    quality_mode: str
    watermarked: bool
    is_free_preview: bool
    created_at: datetime
    before_image_url: str
    after_image_url: str
    source_generation_id: str | None = None


class EditResponse(BaseModel):
    prompt: str
    is_guest_preview: bool
    remaining_credits: int | None = None
    before_image_data_url: str
    after_image_data_url: str
    generation: GenerationSummary | None = None


class CheckoutLinkResponse(BaseModel):
    transaction_id: str
    checkout_url: str


class AdminUserSummary(BaseModel):
    id: str
    email: str
    is_admin: bool
    credit_balance: int
    created_at: datetime
    total_spend_cents: int
    purchased_credits: int
    generated_images: int


class AdminOverview(BaseModel):
    total_users: int
    total_admins: int
    total_generations: int
    total_free_previews: int
    credits_sold: int
    credits_consumed: int
    revenue_cents: int
    recent_payments: list[PaymentSummary]
    recent_users: list[AdminUserSummary]
