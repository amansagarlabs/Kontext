"""MVP email/password auth routes."""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import get_settings
from services.auth_store import (
    authenticate_user,
    create_session,
    create_user_with_password,
    get_user_from_token,
    refresh_session,
    revoke_session_by_token,
)
from services.postgres_store import postgres_enabled

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignUpRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    username: str | None = Field(default=None, min_length=3, max_length=40)
    full_name: str | None = Field(default=None, min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=20, max_length=255)


class LogoutRequest(BaseModel):
    refresh_token: str | None = Field(default=None, min_length=20, max_length=255)


def _extract_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


@router.post("/signup")
async def signup(body: SignUpRequest, request: Request):
    settings = get_settings()
    if not postgres_enabled(settings):
        raise HTTPException(status_code=500, detail="Postgres is not configured.")

    try:
        user = create_user_with_password(
            settings,
            email=body.email,
            password=body.password,
            username=body.username,
            full_name=body.full_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    session = create_session(
        settings,
        user_id=user["id"],
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )

    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "full_name": body.full_name,
            "plan": "free",
        },
        "session": session,
    }


@router.post("/login")
async def login(body: LoginRequest, request: Request):
    settings = get_settings()
    if not postgres_enabled(settings):
        raise HTTPException(status_code=500, detail="Postgres is not configured.")

    user = authenticate_user(settings, email=body.email, password=body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    session = create_session(
        settings,
        user_id=user["id"],
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )

    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "full_name": user["full_name"],
            "plan": user.get("plan", "free"),
        },
        "session": session,
    }


@router.get("/me")
async def me(authorization: str | None = Header(default=None)):
    settings = get_settings()
    if not postgres_enabled(settings):
        raise HTTPException(status_code=500, detail="Postgres is not configured.")

    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token.")

    user = get_user_from_token(settings, token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "full_name": user["full_name"],
            "plan": user.get("plan", "free"),
        }
    }


@router.post("/refresh")
async def refresh(body: RefreshRequest, request: Request):
    settings = get_settings()
    if not postgres_enabled(settings):
        raise HTTPException(status_code=500, detail="Postgres is not configured.")

    session = refresh_session(
        settings,
        refresh_token=body.refresh_token,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    user = get_user_from_token(settings, session["access_token"])
    if not user:
        raise HTTPException(status_code=401, detail="Could not resolve refreshed user.")

    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "full_name": user["full_name"],
        },
        "session": {
            "session_id": session["session_id"],
            "access_token": session["access_token"],
            "refresh_token": session["refresh_token"],
            "expires_at": session["expires_at"],
        },
    }


@router.post("/logout")
async def logout(
    body: LogoutRequest,
    authorization: str | None = Header(default=None),
):
    settings = get_settings()
    if not postgres_enabled(settings):
        raise HTTPException(status_code=500, detail="Postgres is not configured.")

    access_token = _extract_bearer(authorization)
    revoked = False
    if access_token:
        revoked = revoke_session_by_token(settings, token=access_token) or revoked
    if body.refresh_token:
        revoked = revoke_session_by_token(settings, token=body.refresh_token) or revoked

    if not revoked:
        raise HTTPException(status_code=404, detail="No active session found.")

    return {"status": "ok", "message": "Session logged out."}
