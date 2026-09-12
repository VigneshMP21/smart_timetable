"""
Purpose: Export and File Downloads API Router
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Exposes routes for downloading schedules in Excel, PDF and
Word formats. Endpoints are authenticated and export the currently saved
timetable (including manual edits).
"""

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.config import settings
from app.models.timetable_model import TimetableEntry
from app.services.export_excel import ExcelExportService
from app.services.export_pdf import PDFExportService
from app.services.export_word import WordExportService
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/download", tags=["Download"])


async def _ensure_entries(db: AsyncSession, user_id: str) -> None:
    """Raise 404 when the user has no timetable entries yet."""
    entry_check = await db.execute(
        select(TimetableEntry).where(TimetableEntry.created_by == user_id).limit(1)
    )
    if not entry_check.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable has not been generated yet. Please generate it before downloading.",
        )


@router.get(
    "/excel",
    summary="Download Excel timetable",
    description="Generates and downloads a multi-sheet, styled Excel schedule spreadsheet.",
)
async def download_excel(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Downloads Excel timetable file.

    Args:
        user (dict): Authenticated user.
        db (AsyncSession): Active database session.

    Returns:
        FileResponse: The generated Excel file.
    """
    logger.info("Excel export download requested.")
    await _ensure_entries(db, user["id"])

    file_path: Path = settings.GENERATED_PATH / "timetable_schedule.xlsx"
    try:
        await ExcelExportService.export_timetable(db, file_path, user_id=user["id"])

        if not file_path.exists():
            raise FileNotFoundError("Excel file was not saved correctly.")

        return FileResponse(
            path=file_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="timetable_schedule.xlsx",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate/send Excel export: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred exporting Excel: {str(e)}",
        )


@router.get(
    "/pdf",
    summary="Download PDF timetable",
    description="Generates and downloads a print-ready landscaped PDF timetable document.",
)
async def download_pdf(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Downloads PDF timetable file.

    Args:
        user (dict): Authenticated user.
        db (AsyncSession): Active database session.

    Returns:
        FileResponse: The generated PDF document.
    """
    logger.info("PDF export download requested.")
    await _ensure_entries(db, user["id"])

    file_path: Path = settings.GENERATED_PATH / "timetable_schedule.pdf"
    try:
        await PDFExportService.export_timetable(db, file_path, user_id=user["id"])

        if not file_path.exists():
            raise FileNotFoundError("PDF file was not saved correctly.")

        return FileResponse(
            path=file_path,
            media_type="application/pdf",
            filename="timetable_schedule.pdf",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate/send PDF export: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred exporting PDF: {str(e)}",
        )


@router.get(
    "/word",
    summary="Download Word timetable",
    description="Generates and downloads a Word (.docx) timetable document with one table per class.",
)
async def download_word(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Downloads Word (.docx) timetable file.

    Args:
        user (dict): Authenticated user.
        db (AsyncSession): Active database session.

    Returns:
        FileResponse: The generated Word document.
    """
    logger.info("Word export download requested.")
    await _ensure_entries(db, user["id"])

    file_path: Path = settings.GENERATED_PATH / "timetable_schedule.docx"
    try:
        await WordExportService.export_timetable(db, file_path, user_id=user["id"])

        if not file_path.exists():
            raise FileNotFoundError("Word file was not saved correctly.")

        return FileResponse(
            path=file_path,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename="timetable_schedule.docx",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate/send Word export: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred exporting Word: {str(e)}",
        )
