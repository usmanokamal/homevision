import os
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from dotenv import load_dotenv

load_dotenv()

BASE_DIR: Final[Path] = Path(__file__).resolve().parents[1]
DATA_DIR: Final[Path] = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class PaymentPlan:
    id: str
    name: str
    credits: int
    price_cents: int
    description: str
    featured: bool = False


class Settings:
    app_name = "Room Vision API"
    version = "1.0.0"
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    backend_public_url = os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8000").rstrip("/")

    openai_api_key = os.getenv("OPENAI_API_KEY", "")
    openai_image_model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")

    database_url = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(DATA_DIR / 'roomvision.db').as_posix()}",
    )

    jwt_secret = os.getenv("JWT_SECRET", "dev-only-change-me")
    jwt_algorithm = "HS256"
    access_token_expiry_hours = int(os.getenv("ACCESS_TOKEN_EXPIRY_HOURS", "168"))
    session_cookie_name = os.getenv("SESSION_COOKIE_NAME", "roomvision_session")
    cookie_secure = _bool_env("COOKIE_SECURE", False)
    cookie_samesite = os.getenv("COOKIE_SAMESITE", "lax")

    paddle_environment = os.getenv("PADDLE_ENVIRONMENT", "sandbox").strip().lower()
    paddle_api_key = os.getenv("PADDLE_API_KEY", "")
    paddle_client_side_token = os.getenv("PADDLE_CLIENT_SIDE_TOKEN", "")
    paddle_webhook_secret = os.getenv("PADDLE_WEBHOOK_SECRET", "")
    paddle_checkout_base_url = os.getenv(
        "PADDLE_CHECKOUT_BASE_URL",
        f"{frontend_origin.rstrip('/')}/checkout",
    ).rstrip("/")
    paddle_webhook_tolerance_seconds = int(
        os.getenv("PADDLE_WEBHOOK_TOLERANCE_SECONDS", "300")
    )
    billing_currency = os.getenv("BILLING_CURRENCY", "usd")

    storage_backend = os.getenv("STORAGE_BACKEND", "local").lower()
    storage_bucket_name = os.getenv("STORAGE_BUCKET_NAME", "")
    storage_region = os.getenv("STORAGE_REGION", "")
    storage_endpoint_url = os.getenv("STORAGE_ENDPOINT_URL", "")
    storage_access_key_id = os.getenv("STORAGE_ACCESS_KEY_ID", "")
    storage_secret_access_key = os.getenv("STORAGE_SECRET_ACCESS_KEY", "")
    local_storage_dir = Path(
        os.getenv("LOCAL_STORAGE_DIR", str(DATA_DIR / "storage"))
    )

    admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    admin_password = os.getenv("ADMIN_PASSWORD", "")

    max_file_size_bytes = int(os.getenv("MAX_FILE_SIZE_BYTES", str(20 * 1024 * 1024)))
    allowed_content_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
    }

    payment_plans = [
        PaymentPlan(
            id="single",
            name="Single Render",
            credits=1,
            price_cents=200,
            description="One HD export for occasional use.",
        ),
        PaymentPlan(
            id="starter",
            name="Starter",
            credits=10,
            price_cents=1800,
            description="A light pack for early customer trials.",
        ),
        PaymentPlan(
            id="plus",
            name="Plus",
            credits=25,
            price_cents=4000,
            description="Better unit economics for active projects.",
        ),
        PaymentPlan(
            id="pro",
            name="Pro",
            credits=50,
            price_cents=7500,
            description="Best value for steady design iteration.",
            featured=True,
        ),
        PaymentPlan(
            id="studio",
            name="Studio",
            credits=100,
            price_cents=14000,
            description="High-volume credit pool for teams and agencies.",
        ),
    ]


settings = Settings()
