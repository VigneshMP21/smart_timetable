"""
Purpose: Timetable and Statistics API Router
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Exposes endpoints for previewing inputs, generating
schedules, loading/saving/resetting the generated timetable, manual edits and
querying analytics. All endpoints require a valid Supabase access token.
"""

from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.services.scheduler import SchedulerService
from app.services.edit_validation import TimetableEditService
from app.services.statistics import StatisticsService
from app.services.timetable_data import TimetableDataService
from app.services.setup_config import load_config
from app.utils.exceptions import TimetableEditValidationError

from app.schemas.timetable_schema import (
    PreviewResponse,
    TimetableGenerationResponse,
    TimetableUpdateRequest,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Timetable"])


@router.get(
    "/preview",
    response_model=PreviewResponse,
    summary="Preview parsed data",
    description="Returns the uploaded and parsed database records (Classes, Rooms, Subjects, Faculty) plus the Setup configuration."
)
async def preview_data(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves the current scheduling inputs from the database.

    Args:
        user (dict): Authenticated user.
        db (AsyncSession): Active database session.

    Returns:
        PreviewResponse: Data structure summarizing the tables.
    """
    logger.info("Previewing parsed data from database.")
    try:
        domain = await TimetableDataService.load_domain(db)
        config = await load_config(db, user["id"])

        return PreviewResponse(
            classes=[
                {
                    "id": c.id,
                    "class_name": c.class_name,
                    "short_code": c.short_code,
                    "section": c.section,
                }
                for c in domain["classes"]
            ],
            subjects=[
                {
                    "id": str(s.id),
                    "subject_code": s.subject_code,
                    "subject_name": s.subject_name,
                    "branch_classes": s.branch_classes,
                }
                for s in domain["subjects"]
            ],
            faculty=[
                {
                    "id": str(f.id),
                    "faculty_name": f.faculty_name,
                    "subject_id": str(f.subject_id),
                    "branch_classes": f.branch_classes,
                }
                for f in domain["faculties"]
            ],
            rooms=[
                {
                    "id": r.id,
                    "room_no": r.room_no,
                    "class_id": r.class_id,
                }
                for r in domain["rooms"]
            ],
            config=config,
        )
    except Exception as e:
        logger.error(f"Failed to fetch preview details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read database records: {str(e)}",
        )


@router.post(
    "/generate",
    response_model=TimetableGenerationResponse,
    summary="Generate a conflict-free timetable",
    description="Triggers the scheduling algorithm using real classes, rooms, subjects, faculty and the user's Setup configuration."
)
async def generate_timetable(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes schedule generation.

    Args:
        user (dict): Authenticated user (scopes the Setup config lookup).
        db (AsyncSession): Active database session.

    Returns:
        TimetableGenerationResponse: Structured timetable details.
    """
    logger.info("Timetable generation endpoint invoked.")
    try:
        return await SchedulerService.generate_timetable(db, user_id=user["id"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during timetable generation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected scheduler error occurred: {str(e)}",
        )


@router.get(
    "/timetable",
    response_model=TimetableGenerationResponse,
    summary="Load the saved timetable",
    description="Returns the currently saved timetable (including manual edits) without regenerating it."
)
async def get_timetable(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Build the timetable response from saved entries.

    Args:
        user (dict): Authenticated user.
        db (AsyncSession): Active database session.

    Returns:
        TimetableGenerationResponse: Structured timetable details.
    """
    logger.info("Loading saved timetable.")
    try:
        return await SchedulerService.load_timetable(db, user_id=user["id"])
    except Exception as e:
        logger.error(f"Failed to load timetable: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load timetable: {str(e)}",
        )


@router.post(
    "/timetable/update",
    response_model=TimetableGenerationResponse,
    summary="Save manual edits for one class",
    description="Validates the submitted grid for a class against all hard constraints and replaces its saved entries."
)
async def update_timetable(
    payload: TimetableUpdateRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Validate and persist a full-grid manual edit for a single class.

    Args:
        payload (TimetableUpdateRequest): Class id and all timetable cells.
        user (dict): Authenticated user.
        db (AsyncSession): Active database session.

    Returns:
        TimetableGenerationResponse: The refreshed full timetable.
    """
    logger.info("Manual edit submitted for class %s.", payload.class_id)
    try:
        return await TimetableEditService.replace_class_timetable(
            db,
            payload.class_id,
            [entry.model_dump() for entry in payload.entries],
            user_id=user["id"],
        )
    except TimetableEditValidationError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save manual edit: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save timetable edits: {str(e)}",
        )


@router.post(
    "/timetable/reset",
    summary="Reset the timetable",
    description="Deletes all saved timetable entries."
)
async def reset_timetable(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Clear all saved timetable entries.

    Args:
        user (dict): Authenticated user.
        db (AsyncSession): Active database session.

    Returns:
        dict: Reset confirmation.
    """
    logger.info("Timetable reset requested.")
    return await SchedulerService.reset_timetable(db, user_id=user["id"])


@router.get(
    "/statistics",
    summary="Retrieve faculty statistics",
    description="Returns analytical metrics covering teacher workloads and scheduled periods."
)
async def get_statistics(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Gets analytical metrics for teaching allocations.

    Args:
        user (dict): Authenticated user.
        db (AsyncSession): Active database session.

    Returns:
        dict: Faculty statistics output.
    """
    logger.info("Statistics retrieval endpoint invoked.")
    try:
        return await StatisticsService.get_faculty_statistics(db, user_id=user["id"])
    except Exception as e:
        logger.error(f"Failed to compile scheduling analytics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile statistics: {str(e)}",
        )
