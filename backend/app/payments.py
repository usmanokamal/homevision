import hashlib
import hmac
import time
from dataclasses import dataclass

import requests
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from .config import PaymentPlan, settings
from .models import CreditTransaction, Payment, User, utc_now


@dataclass(frozen=True)
class PaddleCheckout:
    transaction_id: str
    checkout_url: str


def list_payment_plans() -> list[PaymentPlan]:
    return settings.payment_plans


def get_payment_plan(plan_id: str) -> PaymentPlan:
    for plan in settings.payment_plans:
        if plan.id == plan_id:
            return plan
    raise HTTPException(status_code=404, detail="Unknown payment plan.")


def get_paddle_api_base_url() -> str:
    if settings.paddle_environment == "sandbox":
        return "https://sandbox-api.paddle.com"
    return "https://api.paddle.com"


def _paddle_headers() -> dict[str, str]:
    if not settings.paddle_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Paddle is not configured yet. Add PADDLE_API_KEY.",
        )

    return {
        "Authorization": f"Bearer {settings.paddle_api_key}",
        "Content-Type": "application/json",
        "Paddle-Version": "1",
    }


def _parse_paddle_error(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text or "Unknown Paddle API error."

    error = payload.get("error") or {}
    details = error.get("detail")
    errors = error.get("errors") or []
    if errors:
        joined = "; ".join(
            item.get("message", "") for item in errors if isinstance(item, dict)
        ).strip()
        if joined:
            return joined
    if details:
        return str(details)
    return response.text or "Unknown Paddle API error."


def _paddle_request(
    method: str,
    path: str,
    *,
    json_body: dict | None = None,
    params: dict[str, str] | None = None,
) -> dict:
    try:
        response = requests.request(
            method=method,
            url=f"{get_paddle_api_base_url()}{path}",
            headers=_paddle_headers(),
            json=json_body,
            params=params,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Paddle API request failed: {exc}",
        ) from exc

    if not response.ok:
        raise HTTPException(
            status_code=502,
            detail=f"Paddle API error: {_parse_paddle_error(response)}",
        )

    payload = response.json()
    return payload.get("data", {})


def create_checkout_transaction(user: User, plan: PaymentPlan) -> PaddleCheckout:
    transaction = _paddle_request(
        "POST",
        "/transactions",
        json_body={
            "items": [
                {
                    "quantity": 1,
                    "price": {
                        "name": f"{plan.name} credit pack",
                        "description": f"{plan.credits} HomeVision image credits",
                        "unit_price": {
                            "amount": str(plan.price_cents),
                            "currency_code": settings.billing_currency.upper(),
                        },
                        "product": {
                            "name": f"HomeVision {plan.name}",
                            "description": f"{plan.credits} credits for HomeVision image renders.",
                            "tax_category": "standard",
                        },
                    },
                }
            ],
            "collection_mode": "automatic",
            "currency_code": settings.billing_currency.upper(),
            "custom_data": {
                "user_id": user.id,
                "user_email": user.email,
                "plan_id": plan.id,
                "credits": plan.credits,
            },
            "checkout": {
                "url": settings.paddle_checkout_base_url,
            },
        },
    )

    checkout = transaction.get("checkout") or {}
    checkout_url = checkout.get("url")
    if not checkout_url:
        raise HTTPException(
            status_code=502,
            detail=(
                "Paddle did not return a checkout URL. Confirm your checkout domain is approved "
                "and PADDLE_CHECKOUT_BASE_URL points to your frontend checkout page."
            ),
        )

    return PaddleCheckout(
        transaction_id=transaction["id"],
        checkout_url=checkout_url,
    )


def verify_paddle_webhook_signature(raw_body: bytes, signature_header: str | None) -> dict[str, str]:
    if not settings.paddle_webhook_secret:
        raise HTTPException(
            status_code=500,
            detail="Paddle webhook is not configured. Add PADDLE_WEBHOOK_SECRET.",
        )

    if not signature_header:
        raise HTTPException(status_code=400, detail="Missing Paddle-Signature header.")

    parts: dict[str, list[str]] = {}
    for chunk in signature_header.split(";"):
        if "=" not in chunk:
            continue
        key, value = chunk.split("=", 1)
        parts.setdefault(key.strip(), []).append(value.strip())

    timestamp = (parts.get("ts") or [None])[0]
    signatures = parts.get("h1") or []
    if not timestamp or not signatures:
        raise HTTPException(status_code=400, detail="Malformed Paddle-Signature header.")

    try:
        timestamp_value = int(timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid Paddle signature timestamp.") from exc

    if abs(int(time.time()) - timestamp_value) > settings.paddle_webhook_tolerance_seconds:
        raise HTTPException(status_code=400, detail="Paddle webhook timestamp is outside tolerance.")

    signed_payload = f"{timestamp}:{raw_body.decode('utf-8')}"
    expected_signature = hmac.new(
        settings.paddle_webhook_secret.encode("utf-8"),
        signed_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not any(hmac.compare_digest(expected_signature, signature) for signature in signatures):
        raise HTTPException(status_code=400, detail="Invalid Paddle webhook signature.")

    return {"ts": timestamp, "h1": signatures[0]}


def apply_completed_transaction(db: Session, transaction_payload: dict) -> None:
    metadata = transaction_payload.get("custom_data") or {}
    user_id = metadata.get("user_id")
    plan = get_payment_plan(str(metadata.get("plan_id", "")))

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="Paddle transaction is missing a user_id in custom_data.",
        )

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Paddle transaction user does not exist.")

    transaction_id = transaction_payload["id"]
    customer_id = transaction_payload.get("customer_id")
    payment_attempts = transaction_payload.get("payments") or []
    payment_attempt_id = None
    if payment_attempts and isinstance(payment_attempts[0], dict):
        payment_attempt_id = payment_attempts[0].get("id")

    totals = (transaction_payload.get("details") or {}).get("totals") or {}
    amount_cents = int(
        totals.get("grand_total")
        or totals.get("total")
        or plan.price_cents
    )
    currency = (totals.get("currency_code") or settings.billing_currency).lower()

    payment = (
        db.query(Payment)
        .filter(Payment.stripe_session_id == transaction_id)
        .one_or_none()
    )
    if payment is None:
        payment = Payment(
            user_id=user.id,
            stripe_session_id=transaction_id,
            stripe_payment_intent_id=payment_attempt_id or customer_id,
            plan_id=plan.id,
            plan_name=plan.name,
            credits=plan.credits,
            amount_cents=amount_cents,
            currency=currency,
            status="completed",
            metadata_json=metadata,
        )
        db.add(payment)
        db.flush()

    if payment.credits_granted_at is not None:
        payment.status = "completed"
        payment.amount_cents = amount_cents
        payment.currency = currency
        return

    user.credit_balance += plan.credits
    payment.status = "completed"
    payment.amount_cents = amount_cents
    payment.currency = currency
    payment.stripe_payment_intent_id = payment_attempt_id or customer_id
    payment.credits_granted_at = utc_now()

    db.add(
        CreditTransaction(
            user_id=user.id,
            payment_id=payment.id,
            delta=plan.credits,
            reason="purchase",
            description=f"Purchased {plan.credits} credits via Paddle ({plan.name}).",
        )
    )
