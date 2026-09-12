"""
Purpose: Setup Configuration API Router
Author: Smart Timetable Backend Team
Module Description: Exposes authenticated endpoints to read and persist a
user's Setup (timetable configuration) document.
"""

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import get_current_user
from app.database import get_db
from app.models.setup_config_model import SetupConfig
from app.schemas.setup_config_schema import SetupConfigResponse, SetupConfigUpdateRequest
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/setup-config", tags=["Setup Configuration"])


@router.get(
    "",
    response_model=SetupConfigResponse,
    summary="Get Setup configuration",
    description="Returns the current user's saved Setup configuration (or defaults when none exists).",
)
async def get_setup_config(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve the authenticated user's Setup configuration.

    Args:
        user (dict): Authenticated user (from the Supabase access token).
        db (AsyncSession): Active database session.

    Returns:
        SetupConfigResponse: The persisted config (raw document) or defaults.
    """
    result = await db.execute(select(SetupConfig).where(SetupConfig.user_id == user["id"]))
    row = result.scalars().first()
    if row is None:
        return SetupConfigResponse(
            exists=False,
            config={},
            updated_at=None,
        )
    return SetupConfigResponse(
        exists=True,
        config=row.config,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


@router.put(
    "",
    response_model=SetupConfigResponse,
    summary="Save Setup configuration",
    description="Persists (inserts or replaces) the current user's Setup configuration document.",
)
async def put_setup_config(
    payload: SetupConfigUpdateRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Save the authenticated user's Setup configuration (upsert on user_id).

    Args:
        payload (SetupConfigUpdateRequest): The configuration document.
        user (dict): Authenticated user.
        db (AsyncSession): Active database session.

    Returns:
        SetupConfigResponse: The newly persisted configuration.
    """
    result = await db.execute(select(SetupConfig).where(SetupConfig.user_id == user["id"]))
    row = result.scalars().first()

    if row is None:
        row = SetupConfig(user_id=user["id"], config=payload.config)
        db.add(row)
    else:
        row.config = payload.config

    await db.commit()
    await db.refresh(row)

    return SetupConfigResponse(
        exists=True,
        config=row.config,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )
