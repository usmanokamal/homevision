from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi import HTTPException, Request, Response, status
from passlib.context import CryptContext

from .config import settings

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_context.verify(password, password_hash)


def create_access_token(user_id: str, email: str, is_admin: bool) -> str:
    expires_at = datetime.now(UTC) + timedelta(hours=settings.access_token_expiry_hours)
    payload = {
        "sub": user_id,
        "email": email,
        "adm": is_admin,
        "exp": expires_at,
        "type": "session",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        ) from exc

    if payload.get("type") != "session" or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session payload.",
        )

    return payload


def create_asset_token(
    viewer_user_id: str,
    generation_id: str,
    variant: str,
    is_admin: bool = False,
) -> str:
    expires_at = datetime.now(UTC) + timedelta(hours=2)
    payload = {
        "sub": viewer_user_id,
        "gid": generation_id,
        "var": variant,
        "adm": is_admin,
        "exp": expires_at,
        "type": "asset",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_asset_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Image link is invalid or expired.",
        ) from exc

    if payload.get("type") != "asset":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Image link is invalid.",
        )

    return payload


def extract_token_from_request(request: Request) -> str | None:
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip()
    return request.cookies.get(settings.session_cookie_name)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.access_token_expiry_hours * 3600,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
