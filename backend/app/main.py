import base64
import json
import os
from contextlib import asynccontextmanager
from io import BytesIO
from typing import Annotated, Literal

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI
from sqlalchemy import func
from sqlalchemy.orm import Session

from .auth import (
    clear_auth_cookie,
    create_access_token,
    create_asset_token,
    decode_access_token,
    decode_asset_token,
    extract_token_from_request,
    hash_password,
    set_auth_cookie,
    verify_password,
)
from .config import settings
from .db import ensure_schema_ready, get_db
from .image_processing import (
    apply_guest_free_tier_policy,
    build_edit_prompt,
    to_data_url,
)
from .models import CreditTransaction, Generation, GuestSession, Payment, User
from .payments import (
    apply_completed_transaction,
    create_checkout_transaction,
    get_payment_plan,
    list_payment_plans,
    verify_paddle_webhook_signature,
)
from .schemas import (
    AdminOverview,
    AdminUserSummary,
    AuthRequest,
    AuthResponse,
    CheckoutLinkRequest,
    CheckoutLinkResponse,
    EditResponse,
    GenerationSummary,
    PaymentSummary,
    PlanSummary,
    RegenerateRequest,
    UserSummary,
)
from .storage import get_storage


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.local_storage_dir.mkdir(parents=True, exist_ok=True)
    ensure_schema_ready()

    if settings.admin_email and settings.admin_password:
        db = next(get_db())
        try:
            admin = db.query(User).filter(User.email == settings.admin_email).one_or_none()
            if admin is None:
                admin = User(
                    email=settings.admin_email,
                    password_hash=hash_password(settings.admin_password),
                    is_admin=True,
                )
                db.add(admin)
            elif not admin.is_admin:
                admin.is_admin = True
            db.commit()
        finally:
            db.close()

    yield


app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_openai_client() -> OpenAI:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is missing. Add it before starting the API.",
        )
    return OpenAI(api_key=settings.openai_api_key)


def get_optional_current_user(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> User | None:
    token = extract_token_from_request(request)
    if not token:
        return None

    payload = decode_access_token(token)
    user = db.get(User, payload["sub"])
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists.")
    return user


def require_current_user(
    current_user: Annotated[User | None, Depends(get_optional_current_user)],
) -> User:
    if current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return current_user


def require_admin(
    current_user: Annotated[User, Depends(require_current_user)],
) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user


def validate_upload(image: UploadFile, image_bytes: bytes) -> None:
    if image.content_type not in settings.allowed_content_types:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Use PNG, JPEG, or WebP.",
        )

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(image_bytes) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=400,
            detail="Image is too large. Use a file smaller than 20 MB.",
        )


def get_or_create_guest_session(db: Session, guest_session_token: str) -> GuestSession:
    guest = (
        db.query(GuestSession)
        .filter(GuestSession.session_token == guest_session_token)
        .one_or_none()
    )
    if guest is None:
        guest = GuestSession(session_token=guest_session_token)
        db.add(guest)
        db.flush()
    return guest


def run_openai_edit(
    image_bytes: bytes,
    filename: str,
    prompt: str,
    quality_mode: str,
) -> tuple[bytes, str]:
    image_stream = BytesIO(image_bytes)
    image_stream.name = filename or "upload.png"

    try:
        result = get_openai_client().images.edit(
            model=settings.openai_image_model,
            image=image_stream,
            prompt=prompt,
            input_fidelity="high" if quality_mode != "free-preview" else "low",
            quality="medium" if quality_mode != "free-preview" else "low",
            size="1536x1024",
            output_format="jpeg",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Image generation failed: {exc}",
        ) from exc

    if not result.data or not result.data[0].b64_json:
        raise HTTPException(status_code=502, detail="OpenAI returned no image data.")

    return base64.b64decode(result.data[0].b64_json), "image/jpeg"


def sanitize_filename(filename: str | None) -> str:
    candidate = filename or "upload.jpg"
    return os.path.basename(candidate).replace(" ", "-")


def build_storage_key(owner_segment: str, generation_id: str, variant: str, filename: str) -> str:
    extension = os.path.splitext(filename)[1].lower() or ".jpg"
    if variant == "after":
        extension = ".jpg"
    return f"{owner_segment}/{generation_id}/{variant}{extension}"


def serialize_plan(plan) -> PlanSummary:
    return PlanSummary(
        id=plan.id,
        name=plan.name,
        credits=plan.credits,
        price_cents=plan.price_cents,
        description=plan.description,
        featured=plan.featured,
        effective_price_per_credit_cents=round(plan.price_cents / plan.credits, 2),
    )


def build_generation_urls(generation: Generation, viewer: User) -> tuple[str, str]:
    before_token = create_asset_token(viewer.id, generation.id, "before", viewer.is_admin)
    after_token = create_asset_token(viewer.id, generation.id, "after", viewer.is_admin)
    before_url = (
        f"{settings.backend_public_url}/api/generations/{generation.id}/asset/before?token={before_token}"
    )
    after_url = (
        f"{settings.backend_public_url}/api/generations/{generation.id}/asset/after?token={after_token}"
    )
    return before_url, after_url


def serialize_generation(generation: Generation, viewer: User) -> GenerationSummary:
    before_url, after_url = build_generation_urls(generation, viewer)
    return GenerationSummary(
        id=generation.id,
        target_surface=generation.target_surface,
        requested_change=generation.requested_change,
        final_prompt=generation.final_prompt,
        quality_mode=generation.quality_mode,
        watermarked=generation.watermarked,
        is_free_preview=generation.is_free_preview,
        created_at=generation.created_at,
        before_image_url=before_url,
        after_image_url=after_url,
        source_generation_id=generation.source_generation_id,
    )


def create_generation_record(
    db: Session,
    owner: User | None,
    guest_session: GuestSession | None,
    source_generation_id: str | None,
    target: str,
    change: str,
    prompt: str,
    before_bytes: bytes,
    before_content_type: str,
    before_filename: str,
    after_bytes: bytes,
    after_content_type: str,
    quality_mode: str,
    watermarked: bool,
    is_free_preview: bool,
) -> Generation:
    generation = Generation(
        user_id=owner.id if owner else None,
        guest_session_id=guest_session.id if guest_session else None,
        source_generation_id=source_generation_id,
        target_surface=target.strip(),
        requested_change=change.strip(),
        final_prompt=prompt,
        before_image_key="",
        before_image_content_type=before_content_type,
        after_image_key="",
        after_image_content_type=after_content_type,
        quality_mode=quality_mode,
        watermarked=watermarked,
        is_free_preview=is_free_preview,
    )
    db.add(generation)
    db.flush()

    owner_segment = f"user-{owner.id}" if owner else f"guest-{guest_session.session_token}"
    storage = get_storage()
    clean_filename = sanitize_filename(before_filename)

    generation.before_image_key = storage.save_bytes(
        build_storage_key(owner_segment, generation.id, "before", clean_filename),
        before_bytes,
        before_content_type,
    )
    generation.after_image_key = storage.save_bytes(
        build_storage_key(owner_segment, generation.id, "after", clean_filename),
        after_bytes,
        after_content_type,
    )

    return generation


def charge_generation_credit(db: Session, user: User, generation: Generation) -> None:
    if user.credit_balance <= 0:
        raise HTTPException(
            status_code=402,
            detail="No credits remaining. Buy a credit pack to continue.",
        )

    user.credit_balance -= 1
    db.add(
        CreditTransaction(
            user_id=user.id,
            generation_id=generation.id,
            delta=-1,
            reason="generation",
            description=f"Used 1 credit for generation {generation.id}.",
        )
    )


def execute_generation_flow(
    db: Session,
    image_bytes: bytes,
    image_content_type: str,
    image_filename: str,
    target: str,
    change: str,
    owner: User | None,
    guest_session: GuestSession | None,
    source_generation_id: str | None = None,
) -> tuple[Generation, bytes, bytes]:
    prompt = build_edit_prompt(target=target, desired_change=change)
    quality_mode = "paid"
    watermarked = False
    is_free_preview = False

    if owner is None:
        if guest_session is None:
            raise HTTPException(status_code=400, detail="Guest session is required.")
        if guest_session.has_used_free_preview:
            raise HTTPException(
                status_code=402,
                detail="Your free preview is already used. Create an account and buy credits to continue.",
            )
        quality_mode = "free-preview"
        watermarked = True
        is_free_preview = True
    elif owner.credit_balance <= 0:
        raise HTTPException(
            status_code=402,
            detail="No credits remaining. Buy a credit pack to continue.",
        )

    generated_bytes, generated_content_type = run_openai_edit(
        image_bytes=image_bytes,
        filename=image_filename,
        prompt=prompt,
        quality_mode=quality_mode,
    )

    if owner is None:
        generated_bytes, generated_content_type = apply_guest_free_tier_policy(generated_bytes)
        guest_session.has_used_free_preview = True

    generation = create_generation_record(
        db=db,
        owner=owner,
        guest_session=guest_session,
        source_generation_id=source_generation_id,
        target=target,
        change=change,
        prompt=prompt,
        before_bytes=image_bytes,
        before_content_type=image_content_type,
        before_filename=image_filename,
        after_bytes=generated_bytes,
        after_content_type=generated_content_type,
        quality_mode=quality_mode,
        watermarked=watermarked,
        is_free_preview=is_free_preview,
    )

    if owner is not None:
        charge_generation_credit(db, owner, generation)

    return generation, image_bytes, generated_bytes


@app.get("/api/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/pricing/plans", response_model=list[PlanSummary])
async def get_pricing_plans() -> list[PlanSummary]:
    return [serialize_plan(plan) for plan in list_payment_plans()]


@app.post("/api/auth/signup", response_model=AuthResponse)
async def signup(
    payload: AuthRequest,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> AuthResponse:
    email = payload.email.strip().lower()
    existing = db.query(User).filter(User.email == email).one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email, user.is_admin)
    set_auth_cookie(response, token)
    return AuthResponse(user=UserSummary.model_validate(user))


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(
    payload: AuthRequest,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> AuthResponse:
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token(user.id, user.email, user.is_admin)
    set_auth_cookie(response, token)
    return AuthResponse(user=UserSummary.model_validate(user))


@app.post("/api/auth/logout")
async def logout(response: Response) -> dict[str, str]:
    clear_auth_cookie(response)
    return {"status": "logged_out"}


@app.get("/api/auth/me", response_model=AuthResponse)
async def me(
    current_user: Annotated[User, Depends(require_current_user)],
) -> AuthResponse:
    return AuthResponse(user=UserSummary.model_validate(current_user))


@app.get("/api/generations", response_model=list[GenerationSummary])
async def list_generations(
    current_user: Annotated[User, Depends(require_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[GenerationSummary]:
    generations = (
        db.query(Generation)
        .filter(Generation.user_id == current_user.id)
        .order_by(Generation.created_at.desc())
        .limit(50)
        .all()
    )
    return [serialize_generation(generation, current_user) for generation in generations]


@app.get("/api/billing/payments", response_model=list[PaymentSummary])
async def list_payments(
    current_user: Annotated[User, Depends(require_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[PaymentSummary]:
    payments = (
        db.query(Payment)
        .filter(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        PaymentSummary(
            id=payment.id,
            plan_id=payment.plan_id,
            plan_name=payment.plan_name,
            credits=payment.credits,
            amount_cents=payment.amount_cents,
            currency=payment.currency,
            status=payment.status,
            created_at=payment.created_at,
        )
        for payment in payments
    ]


@app.post("/api/billing/checkout-link", response_model=CheckoutLinkResponse)
async def create_checkout(
    payload: CheckoutLinkRequest,
    current_user: Annotated[User, Depends(require_current_user)],
) -> CheckoutLinkResponse:
    plan = get_payment_plan(payload.plan_id)
    checkout = create_checkout_transaction(current_user, plan)
    return CheckoutLinkResponse(
        transaction_id=checkout.transaction_id,
        checkout_url=checkout.checkout_url,
    )


@app.post("/api/billing/paddle-webhook")
async def paddle_webhook(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, bool]:
    payload = await request.body()
    signature = request.headers.get("Paddle-Signature")

    verify_paddle_webhook_signature(payload, signature)

    try:
        event = json.loads(payload.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid Paddle webhook payload: {exc}") from exc

    if event.get("event_type") == "transaction.completed":
        apply_completed_transaction(db, event["data"])
        db.commit()

    return {"received": True}


@app.post("/api/edit-image", response_model=EditResponse)
async def edit_image(
    image: UploadFile = File(...),
    target: str = Form(...),
    change: str = Form(...),
    guest_session_token: Annotated[str | None, Header(alias="X-Guest-Session")] = None,
    current_user: Annotated[User | None, Depends(get_optional_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
) -> EditResponse:
    if not target.strip():
        raise HTTPException(status_code=400, detail="Target surface is required.")
    if not change.strip():
        raise HTTPException(status_code=400, detail="Change prompt is required.")

    image_bytes = await image.read()
    validate_upload(image, image_bytes)

    guest_session = None
    if current_user is None:
        if not guest_session_token:
            raise HTTPException(status_code=400, detail="Guest session header is required.")
        guest_session = get_or_create_guest_session(db, guest_session_token)

    generation, before_bytes, after_bytes = execute_generation_flow(
        db=db,
        image_bytes=image_bytes,
        image_content_type=image.content_type or "image/jpeg",
        image_filename=sanitize_filename(image.filename),
        target=target.strip(),
        change=change.strip(),
        owner=current_user,
        guest_session=guest_session,
    )
    db.commit()
    if current_user is not None:
        db.refresh(current_user)
        db.refresh(generation)

    return EditResponse(
        prompt=generation.final_prompt,
        is_guest_preview=current_user is None,
        remaining_credits=current_user.credit_balance if current_user is not None else None,
        before_image_data_url=to_data_url(before_bytes, generation.before_image_content_type),
        after_image_data_url=to_data_url(after_bytes, generation.after_image_content_type),
        generation=serialize_generation(generation, current_user) if current_user is not None else None,
    )


@app.post("/api/generations/{generation_id}/regenerate", response_model=EditResponse)
async def regenerate_generation(
    generation_id: str,
    payload: RegenerateRequest,
    current_user: Annotated[User, Depends(require_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EditResponse:
    source_generation = (
        db.query(Generation)
        .filter(Generation.id == generation_id, Generation.user_id == current_user.id)
        .one_or_none()
    )
    if source_generation is None:
        raise HTTPException(status_code=404, detail="Generation not found.")

    target = (payload.target or source_generation.target_surface).strip()
    change = (payload.change or source_generation.requested_change).strip()
    if not target or not change:
        raise HTTPException(status_code=400, detail="Target and change are required.")

    before_bytes, before_content_type = get_storage().read_bytes(source_generation.before_image_key)
    generation, stored_before_bytes, after_bytes = execute_generation_flow(
        db=db,
        image_bytes=before_bytes,
        image_content_type=before_content_type,
        image_filename="regenerate.jpg",
        target=target,
        change=change,
        owner=current_user,
        guest_session=None,
        source_generation_id=source_generation.id,
    )
    db.commit()
    db.refresh(current_user)
    db.refresh(generation)

    return EditResponse(
        prompt=generation.final_prompt,
        is_guest_preview=False,
        remaining_credits=current_user.credit_balance,
        before_image_data_url=to_data_url(stored_before_bytes, generation.before_image_content_type),
        after_image_data_url=to_data_url(after_bytes, generation.after_image_content_type),
        generation=serialize_generation(generation, current_user),
    )


@app.get("/api/generations/{generation_id}/asset/{variant}")
async def generation_asset(
    generation_id: str,
    variant: Literal["before", "after"],
    token: str,
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    payload = decode_asset_token(token)
    if payload.get("gid") != generation_id or payload.get("var") != variant:
        raise HTTPException(status_code=401, detail="Image link does not match the requested asset.")

    generation = db.get(Generation, generation_id)
    if generation is None:
        raise HTTPException(status_code=404, detail="Generation not found.")

    viewer_id = payload.get("sub")
    is_admin = bool(payload.get("adm"))
    if not is_admin and generation.user_id != viewer_id:
        raise HTTPException(status_code=403, detail="You do not have access to this image.")

    storage_key = generation.before_image_key if variant == "before" else generation.after_image_key
    image_bytes, content_type = get_storage().read_bytes(storage_key)
    return StreamingResponse(BytesIO(image_bytes), media_type=content_type)


@app.get("/api/admin/overview", response_model=AdminOverview)
async def admin_overview(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminOverview:
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_admins = db.query(func.count(User.id)).filter(User.is_admin.is_(True)).scalar() or 0
    total_generations = db.query(func.count(Generation.id)).scalar() or 0
    total_free_previews = (
        db.query(func.count(Generation.id)).filter(Generation.is_free_preview.is_(True)).scalar() or 0
    )
    credits_sold = (
        db.query(func.coalesce(func.sum(CreditTransaction.delta), 0))
        .filter(CreditTransaction.reason == "purchase")
        .scalar()
        or 0
    )
    credits_consumed = abs(
        (
            db.query(func.coalesce(func.sum(CreditTransaction.delta), 0))
            .filter(CreditTransaction.reason == "generation")
            .scalar()
            or 0
        )
    )
    revenue_cents = (
        db.query(func.coalesce(func.sum(Payment.amount_cents), 0))
        .filter(Payment.status.in_(["completed", "paid"]))
        .scalar()
        or 0
    )

    recent_payments_query = db.query(Payment).order_by(Payment.created_at.desc()).limit(10).all()
    recent_payments = [
        PaymentSummary(
            id=payment.id,
            plan_id=payment.plan_id,
            plan_name=payment.plan_name,
            credits=payment.credits,
            amount_cents=payment.amount_cents,
            currency=payment.currency,
            status=payment.status,
            created_at=payment.created_at,
        )
        for payment in recent_payments_query
    ]

    recent_users_query = db.query(User).order_by(User.created_at.desc()).limit(10).all()
    recent_users: list[AdminUserSummary] = []
    for user in recent_users_query:
        total_spend_cents = (
            db.query(func.coalesce(func.sum(Payment.amount_cents), 0))
            .filter(Payment.user_id == user.id, Payment.status.in_(["completed", "paid"]))
            .scalar()
            or 0
        )
        purchased_credits = (
            db.query(func.coalesce(func.sum(CreditTransaction.delta), 0))
            .filter(
                CreditTransaction.user_id == user.id,
                CreditTransaction.reason == "purchase",
            )
            .scalar()
            or 0
        )
        generated_images = (
            db.query(func.count(Generation.id))
            .filter(Generation.user_id == user.id)
            .scalar()
            or 0
        )
        recent_users.append(
            AdminUserSummary(
                id=user.id,
                email=user.email,
                is_admin=user.is_admin,
                credit_balance=user.credit_balance,
                created_at=user.created_at,
                total_spend_cents=total_spend_cents,
                purchased_credits=purchased_credits,
                generated_images=generated_images,
            )
        )

    return AdminOverview(
        total_users=total_users,
        total_admins=total_admins,
        total_generations=total_generations,
        total_free_previews=total_free_previews,
        credits_sold=credits_sold,
        credits_consumed=credits_consumed,
        revenue_cents=revenue_cents,
        recent_payments=recent_payments,
        recent_users=recent_users,
    )
