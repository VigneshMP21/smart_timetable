"""
Purpose: Smart Timetable Bulk Upload API Router
Author: Smart Timetable Backend Team
Created Date: 2026-08-03
Module Description: Exposes the single-workbook import endpoint (POST /upload)
and the sample template download (GET /upload/template). The upload accepts a
workbook with Classes, Rooms, Subjects and Faculty sheets, validates the whole
file up front, and imports everything inside one database transaction.

This replaces the legacy configuration-format upload (classes/faculty/subjects
+ constraints sheets). The old upload cleared all tables before inserting; the
new flow never clears data and instead skips duplicates, so existing records
survive the import.
"""

from io import BytesIO
from typing import Any, Dict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.schemas.upload_schema import BulkImportSummary, EntityImportSummary
from app.services.bulk_import import generate_template_workbook, process_bulk_upload
from app.utils.exceptions import ExcelValidationError
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Upload"])

ALLOWED_EXTENSIONS = (".xlsx", ".xls")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/upload",
    response_model=BulkImportSummary,
    summary="Import a Smart Timetable workbook",
    description="Uploads a workbook with Classes, Rooms, Subjects and Faculty sheets, "
                "validates the entire file, and imports all rows inside a single transaction. "
                "Duplicates are skipped and reported per sheet.",
)
async def bulk_upload(
    file: UploadFile = File(..., description="Excel workbook (.xlsx or .xls) with 4 sheets"),
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Validate and import a 4-sheet workbook.

    Args:
        file (UploadFile): The Excel workbook.
        db (AsyncSession): Active database session (transaction is committed here).
        user (Dict[str, Any]): Authenticated user from the JWT.

    Returns:
        BulkImportSummary: Per-sheet imported/skipped counts.

    Raises:
        ExcelValidationError: When the workbook fails validation (nothing imported).
        HTTPException: When the file is invalid or the transaction fails.
    """
    filename = (file.filename or "").lower()
    if not filename.endswith(ALLOWED_EXTENSIONS):
        raise ExcelValidationError(
            "Invalid file type.",
            [{"sheet": None, "row": None, "problem": "Only Excel files (.xlsx or .xls) are allowed."}],
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise ExcelValidationError(
            "File too large.",
            [{"sheet": None, "row": None, "problem": "Maximum allowed file size is 10 MB."}],
        )

    try:
        counts = await process_bulk_upload(db, user, contents)
        await db.commit()
    except ExcelValidationError:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        logger.exception("Bulk import failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Import failed. No data was saved.",
        )

    imported_total = sum(counts[sheet]["imported"] for sheet in counts)
    skipped_total = sum(counts[sheet]["skipped"] for sheet in counts)

    return BulkImportSummary(
        message=f"Workbook imported successfully. {imported_total} record(s) added, "
                f"{skipped_total} duplicate(s) skipped.",
        classes=EntityImportSummary(**counts["classes"]),
        rooms=EntityImportSummary(**counts["rooms"]),
        subjects=EntityImportSummary(**counts["subjects"]),
        faculty=EntityImportSummary(**counts["faculty"]),
        imported_total=imported_total,
        skipped_total=skipped_total,
    )


@router.get(
    "/upload/template",
    summary="Download the Smart Timetable import template",
    description="Downloads a sample .xlsx workbook with Classes, Rooms, Subjects and "
                "Faculty sheets pre-filled with sample rows.",
)
async def download_template(
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Generate and stream the sample workbook.

    Args:
        user (Dict[str, Any]): Authenticated user from the JWT.

    Returns:
        StreamingResponse: The sample workbook as a .xlsx download.
    """
    buffer = BytesIO(generate_template_workbook())
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="smart_timetable_template.xlsx"'
        },
    )
