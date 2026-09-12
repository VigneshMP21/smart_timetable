"""
Purpose: Health API Router
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Exposes server status and database connectivity status verification.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    summary="Check server health",
    description="Returns the status of the server and verifies that the database is reachable."
)
async def check_health(db: AsyncSession = Depends(get_db)):
    """
    Validates server responsiveness and DB connectivity.

    Args:
        db (AsyncSession): Active database session dependency.

    Returns:
        dict: Health check summary.
    """
    logger.debug("Health check invoked.")
    try:
        await db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        logger.error(f"Health check failed database ping: {str(e)}")
        db_status = "unhealthy"

    return {
        "status": "online",
        "database": db_status
    }
