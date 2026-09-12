"""
Purpose: Authentication API Router (Supabase Auth + profiles)
Author: Smart Timetable Backend Team
Module Description: Exposes the minimal backend auth surface. Sign up, sign in,
email verification and password resets are handled entirely by Supabase Auth
on the frontend. The backend only:

  - Validates the Supabase access token (Bearer header) on protected routes.
  - Serves the user's public profile row from the "profiles" table, creating
    the row on demand the first time an authenticated user is seen.

Endpoints:
  GET  /auth/me              - Current user info from the Supabase token.
  GET  /auth/profile         - Current user's profile row (auto-created).
  PUT  /auth/profile         - Update the current user's profile.
  DELETE /auth/account       - Permanently delete the account (user + data).
  GET  /auth/public-example  - Public API example (no token needed).
  GET  /auth/protected-example - Protected API example (token required).
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import get_current_user
from app.database import get_db
from app.models.class_model import Class
from app.models.profile_model import Profile
from app.schemas.auth_schema import (
    MessageResponse,
    ProfileResponse,
    ProfileUpdate,
    ProfileUpdateResponse,
    UserInfo,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _iso(value: Optional[datetime]) -> Optional[str]:
    """
    Render a datetime as an ISO string with an explicit UTC offset.

    Postgres returns timezone-aware datetimes, but naive values are handled
    defensively (assumed to be UTC).
    """
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _profile_to_dict(profile: Profile, email: Optional[str] = None) -> Dict[str, Any]:
    """
    Convert a Profile row into the public dictionary shape used by the API.
    """
    return {
        "id": str(profile.id),
        "email": email,
        "full_name": profile.full_name or "",
        "college_name": profile.college_name or "",
        "department": profile.department or "",
        "role": profile.role or "user",
        "phone_number": profile.phone_number or "",
        "profile_image": profile.profile_image or "",
        "created_at": _iso(profile.created_at),
        "updated_at": _iso(profile.updated_at),
    }


async def _get_or_create_profile(db: AsyncSession, user: Dict[str, Any]) -> Profile:
    """
    Fetch the profile row for the authenticated user, creating it on first use.

    Args:
        db (AsyncSession): Database session.
        user (Dict[str, Any]): Normalized authenticated user dict.

    Returns:
        Profile: The profile row.
    """
    user_id = uuid.UUID(str(user["id"]))
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()

    if profile is None:
        profile = Profile(
            id=user_id,
            full_name=user.get("full_name") or "",
            college_name=user.get("college_name") or "",
            department=user.get("department") or "",
            phone_number=user.get("phone_number") or "",
            role="user",
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        logger.info("Created profile row for user %s", user_id)

    return profile


async def _delete_supabase_user(user_id: str) -> None:
    """
    Permanently delete the Supabase Auth user via the Admin API.

    Uses the service-role key so the call is not subject to Row Level
    Security. Deleting the auth.users row cascades to the public.profiles
    row (see database/schema/supabase.sql).

    Args:
        user_id (str): The Supabase auth.users id to delete.

    Raises:
        HTTPException: If the Admin API cannot be reached or rejects the call.
    """
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account deletion is not configured. Please contact support.",
        )

    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{user_id}"
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.delete(url, headers=headers)
    except httpx.HTTPError as exc:
        logger.error("Supabase admin delete request failed for %s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the account service. Please try again.",
        ) from exc

    if response.status_code == status.HTTP_404_NOT_FOUND:
        # The user is already gone - treat the delete as idempotent.
        return
    if response.status_code not in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT):
        logger.error(
            "Failed to delete Supabase user %s: %s %s",
            user_id,
            response.status_code,
            response.text,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Account deletion failed. Please try again later.",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get(
    "/me",
    response_model=UserInfo,
    summary="Get current user from token",
    description="Returns the authenticated user's information decoded from the Supabase access token.",
)
async def get_me(user: Dict[str, Any] = Depends(get_current_user)) -> UserInfo:
    """
    Return the decoded Supabase token claims as the current user.

    Args:
        user (Dict[str, Any]): Resolved by the get_current_user dependency.

    Returns:
        UserInfo: Normalized user information.
    """
    logger.info("User %s requested /auth/me", user.get("id"))
    return UserInfo(**{k: user.get(k) for k in ("id", "email", "role")})


@router.get(
    "/profile",
    response_model=ProfileResponse,
    summary="Get current user profile",
    description="Fetches the current user's row from the profiles table (creates it on first use).",
)
async def get_user_profile(
    user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    """
    Fetch the profile row associated with the authenticated user.

    Args:
        user (Dict[str, Any]): Resolved authenticated user.
        db (AsyncSession): Database session.

    Returns:
        ProfileResponse: The profile object.
    """
    logger.info("User %s requested /auth/profile", user.get("id"))
    profile = await _get_or_create_profile(db, user)
    return ProfileResponse(profile=_profile_to_dict(profile, email=user.get("email")))


@router.put(
    "/profile",
    response_model=ProfileUpdateResponse,
    summary="Update current user profile",
    description="Updates editable fields on the current user's profile row.",
)
async def update_user_profile(
    payload: ProfileUpdate,
    user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileUpdateResponse:
    """
    Update editable profile columns for the authenticated user.

    Args:
        payload (ProfileUpdate): Fields to update.
        user (Dict[str, Any]): Resolved authenticated user.
        db (AsyncSession): Database session.

    Returns:
        ProfileUpdateResponse: The updated profile.
    """
    logger.info("User %s updating profile", user.get("id"))

    update_data: Dict[str, Any] = {
        key: value
        for key, value in payload.model_dump(exclude_unset=True).items()
        if value is not None
    }
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields provided to update.")

    profile = await _get_or_create_profile(db, user)

    for key, value in update_data.items():
        setattr(profile, key, value.strip() if isinstance(value, str) else value)
    await db.commit()
    await db.refresh(profile)

    return ProfileUpdateResponse(profile=_profile_to_dict(profile, email=user.get("email")))


@router.delete(
    "/account",
    response_model=MessageResponse,
    summary="Permanently delete account",
    description="Deletes the authenticated user's classes and then removes the "
                "Supabase Auth user (the profile row cascades with it). This "
                "action is permanent and cannot be undone.",
)
async def delete_account(
    user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Permanently delete the authenticated user's account and data.

    User-owned classes are removed first (subjects and timetable entries
    cascade), then the Supabase Auth user is deleted via the Admin API. The
    profile row is removed by the auth.users -> profiles cascade.

    Args:
        user (Dict[str, Any]): Resolved authenticated user.
        db (AsyncSession): Database session.

    Returns:
        MessageResponse: Confirmation of the deletion.
    """
    user_id = str(user["id"])
    logger.info("User %s requested permanent account deletion", user_id)

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user identifier.",
        )

    await db.execute(delete(Class).where(Class.created_by == user_uuid))
    await db.commit()

    await _delete_supabase_user(user_id)

    return MessageResponse(message="Your account has been permanently deleted.")


@router.get(
    "/public-example",
    response_model=MessageResponse,
    summary="Public API example",
    description="Accessible without any authentication token.",
)
async def public_example() -> MessageResponse:
    """
    Demonstrate a public endpoint that requires no authentication.

    Returns:
        MessageResponse: A friendly greeting.
    """
    return MessageResponse(message="Hello! This is a public endpoint - no token required.")


@router.get(
    "/protected-example",
    response_model=MessageResponse,
    summary="Protected API example",
    description="Requires a valid Supabase access token in the Authorization header.",
)
async def protected_example(
    user: Dict[str, Any] = Depends(get_current_user),
) -> MessageResponse:
    """
    Demonstrate an endpoint protected by Supabase JWT validation.

    Args:
        user (Dict[str, Any]): Resolved authenticated user.

    Returns:
        MessageResponse: Confirmation that the caller is authenticated.
    """
    logger.info("Protected example accessed by user %s", user.get("id"))
    return MessageResponse(
        message=f"Authenticated as {user.get('email', user.get('id'))}. Token is valid."
    )
