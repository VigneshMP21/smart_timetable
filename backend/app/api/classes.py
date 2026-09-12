"""
Purpose: Add Class API Router
Author: Smart Timetable Backend Team
Module Description: Exposes the Add Class module endpoints.

Endpoints:
  POST /classes/upload  - Parse + validate an Excel file, return a preview.
  POST /classes/create  - Insert one class (manual) or a batch (Excel save).
  GET  /classes         - List classes with instant search + pagination.
  PUT  /classes/{id}    - Edit a class.
  DELETE /classes/{id}  - Delete a class.

Workflow (Excel):
  upload -> validate Excel -> preview records -> create (save) -> success.

Database interaction:
  All writes set created_by to the authenticated user (JWT) and respect the
  unique (class_name, section) and (short_code, section) constraints.
"""

import re
import uuid
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.models.class_model import Class
from app.schemas.class_schema import (
    ClassBatchDeleteRequest,
    ClassCreate,
    ClassRecord,
    ClassResponse,
    ClassUpdate,
    ClassUploadResult,
    CreateClassesRequest,
)
from app.utils.exceptions import ExcelValidationError
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/classes", tags=["Classes"])

# Allowed spreadsheet extensions and the maximum accepted upload size.
ALLOWED_EXTENSIONS = (".xlsx", ".xls")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_header(value: str) -> str:
    """
    Normalize a header label so column aliases can be matched reliably.

    "Class / Branch Name" -> "classbranchname"
    """
    return re.sub(r"[^a-z]+", "", str(value).strip().lower())


def _map_columns(columns: List[str]) -> Dict[str, str]:
    """
    Map the raw Excel columns to the canonical record keys.

    Returns:
        Dict[str, str]: {canonical_key: actual_column_name}
    """
    mapping: Dict[str, str] = {}
    class_aliases = {"classname", "classbranchname", "class", "branchname", "branch"}
    code_aliases = {"shortcode", "short", "code", "classcode", "classcode"}
    section_aliases = {"section", "sec", "classsection"}

    for col in columns:
        key = _normalize_header(col)
        if "class_name" not in mapping and (key in class_aliases or "class" in key):
            mapping["class_name"] = col
        elif "short_code" not in mapping and (key in code_aliases or "short" in key or "code" in key):
            mapping["short_code"] = col
        elif "section" not in mapping and (key in section_aliases or "section" in key):
            mapping["section"] = col

    return mapping


def _clean(value: Any) -> str:
    """Convert a cell value to a cleaned string (empty for NaN/None)."""
    if value is None:
        return ""
    if pd.isna(value):
        return ""
    return str(value).strip()


def _format_errors(rows: List[ClassRecord]) -> List[ClassRecord]:
    """
    Mark in-file duplicates so the preview shows the conflicting rows.
    Duplicates are detected on (class_name, section) and (short_code, section).
    """
    seen_name: Dict[Tuple[str, str], int] = {}
    seen_code: Dict[Tuple[str, str], int] = {}

    for record in rows:
        name_key = (record.class_name.lower(), record.section.upper())
        code_key = (record.short_code.lower(), record.section.upper())

        if name_key in seen_name:
            record.errors.append("Duplicate class name + section within the file.")
        else:
            seen_name[name_key] = 1

        if code_key in seen_code:
            record.errors.append("Duplicate short code + section within the file.")
        else:
            seen_code[code_key] = 1

    return rows


async def _fetch_existing_pairs(db: AsyncSession) -> Dict[str, set]:
    """
    Load the current unique (name/section) and (code/section) keys from the DB.

    Returns:
        Dict[str, set]: {"names": {(name, section), ...}, "codes": {(code, section), ...}}
    """
    result = await db.execute(select(Class.class_name, Class.short_code, Class.section))
    rows = result.all()
    return {
        "names": {(r[0].lower(), r[2].upper()) for r in rows},
        "codes": {(r[1].lower(), r[2].upper()) for r in rows},
    }


def _normalize_record(item: ClassCreate) -> Tuple[str, str, str]:
    """
    Normalize a ClassCreate into (class_name, short_code, section)
    with canonical casing (codes/sections uppercased).
    """
    return (
        " ".join(item.class_name.split()),
        " ".join(item.short_code.split()).upper(),
        " ".join(item.section.split()).upper(),
    )


# ---------------------------------------------------------------------------
# POST /classes/upload - parse + validate + preview (no DB write)
# ---------------------------------------------------------------------------
@router.post(
    "/upload",
    response_model=ClassUploadResult,
    summary="Upload and validate a classes Excel file",
    description="Parses a .xlsx/.xls file with Class Name / Short Code / Section columns, "
                "validates it, and returns a preview of the records. Nothing is saved."
)
async def upload_classes(
    file: UploadFile = File(..., description="Excel file (.xlsx or .xls)"),
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Validate the spreadsheet shape and return preview records.

    Args:
        file (UploadFile): The Excel workbook.
        db (AsyncSession): Active database session (used for duplicate checks).
        user (Dict[str, Any]): Authenticated user from the JWT.

    Returns:
        ClassUploadResult: Parsed records (with per-row errors) and error count.
    """
    filename = (file.filename or "").lower()
    if not filename.endswith(ALLOWED_EXTENSIONS):
        raise ExcelValidationError(
            "Invalid file type.",
            [{"error": "Only Excel files (.xlsx or .xls) are allowed."}],
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise ExcelValidationError(
            "File too large.",
            [{"error": "Maximum allowed file size is 10 MB."}],
        )

    try:
        df = pd.read_excel(BytesIO(contents))
    except Exception as exc:  # corrupt file / unsupported engine
        logger.error("Failed to parse classes Excel: %s", exc)
        raise ExcelValidationError(
            "Could not read the Excel file.",
            [{"error": "The file appears to be corrupted or not a valid Excel workbook."}],
        )

    if df is None or df.empty:
        raise ExcelValidationError(
            "Empty workbook.",
            [{"error": "The workbook does not contain any rows."}],
        )

    df.columns = [str(c).strip() for c in df.columns]
    mapping = _map_columns(list(df.columns))

    missing = [
        name
        for name, key in (("Class Name", "class_name"), ("Short Code", "short_code"), ("Section", "section"))
        if key not in mapping
    ]
    if missing:
        raise ExcelValidationError(
            "Invalid columns.",
            [
                {
                    "error": (
                        f"Missing required column(s): {', '.join(missing)}. "
                        f"Expected 'Class Name', 'Short Code' and 'Section'."
                    )
                }
            ],
        )

    records: List[ClassRecord] = []
    for row_index, row in df.iterrows():
        class_name = _clean(row[mapping["class_name"]])
        short_code = _clean(row[mapping["short_code"]])
        section = _clean(row[mapping["section"]])

        # Skip entirely empty rows.
        if not class_name and not short_code and not section:
            continue

        errors: List[str] = []
        if not class_name:
            errors.append(f"Row {row_index + 2}: Class name is required.")
        if not short_code:
            errors.append(f"Row {row_index + 2}: Short code is required.")
        if not section:
            errors.append(f"Row {row_index + 2}: Section is required.")

        records.append(
            ClassRecord(
                class_name=class_name,
                short_code=short_code.upper(),
                section=section.upper(),
                errors=errors,
            )
        )

    if not records:
        raise ExcelValidationError(
            "No records found.",
            [{"error": "The workbook does not contain any class records."}],
        )

    # Flag duplicates that already exist in the database so the user can
    # decide before hitting "Save to database".
    existing = await _fetch_existing_pairs(db)
    for record in records:
        name_key = (record.class_name.lower(), record.section)
        code_key = (record.short_code.lower(), record.section)
        if name_key in existing["names"]:
            record.errors.append("This class name + section already exists.")
        if code_key in existing["codes"]:
            record.errors.append("This short code + section already exists.")

    records = _format_errors(records)
    error_count = sum(1 for r in records if r.errors)

    logger.info("Parsed %d class records (%d with errors).", len(records), error_count)
    return ClassUploadResult(
        status="success" if error_count == 0 else "partial",
        message=(
            f"File parsed successfully. {len(records)} record(s) ready for review."
            if error_count == 0
            else f"File parsed with {error_count} record(s) needing attention."
        ),
        records=records,
        error_count=error_count,
    )


# ---------------------------------------------------------------------------
# POST /classes/create - manual single entry OR batch save from preview
# ---------------------------------------------------------------------------
@router.post(
    "/create",
    summary="Create one or more classes",
    description="Inserts a single class (manual entry) or a batch of classes "
                "(Excel save step). Duplicates are skipped with error details."
)
async def create_classes(
    payload: CreateClassesRequest,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Insert class records into the database.

    Args:
        payload (CreateClassesRequest): Either {records: [...]} or a single
            {class_name, short_code, section} object.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user (recorded as created_by).

    Returns:
        dict: Inserted rows plus per-record duplicate/validation errors.
    """
    # Resolve the list of records to persist.
    if payload.records is not None and len(payload.records) > 0:
        items = payload.records
    elif payload.class_name and payload.short_code and payload.section:
        items = [ClassCreate(class_name=payload.class_name, short_code=payload.short_code, section=payload.section)]
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either 'records' (batch) or class_name/short_code/section (single).",
        )

    existing = await _fetch_existing_pairs(db)
    batch_names: set = set()
    batch_codes: set = set()

    inserted: List[Dict[str, Any]] = []
    inserted_ids: List[int] = []
    pending_rows: List[Class] = []
    errors: List[Dict[str, Any]] = []

    for item in items:
        class_name, short_code, section = _normalize_record(item)
        name_key = (class_name.lower(), section)
        code_key = (short_code.lower(), section)

        if name_key in existing["names"] or name_key in batch_names:
            errors.append({
                "class_name": class_name,
                "short_code": short_code,
                "section": section,
                "error": "Duplicate class name + section.",
            })
            continue
        if code_key in existing["codes"] or code_key in batch_codes:
            errors.append({
                "class_name": class_name,
                "short_code": short_code,
                "section": section,
                "error": "Duplicate short code + section.",
            })
            continue

        row = Class(
            class_name=class_name,
            short_code=short_code,
            section=section,
            created_by=uuid.UUID(str(user["id"])),
        )
        db.add(row)
        pending_rows.append(row)

        existing["names"].add(name_key)
        existing["codes"].add(code_key)
        batch_names.add(name_key)
        batch_codes.add(code_key)

    try:
        if pending_rows:
            await db.flush()
        inserted_ids = [row.id for row in pending_rows]
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to insert classes: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save classes: {exc}",
        )

    # Re-select inserted rows so serialized ids/timestamps are accurate.
    if inserted_ids:
        result = await db.execute(
            select(Class).where(Class.id.in_(inserted_ids)).order_by(Class.id)
        )
        inserted = [
            ClassResponse.model_validate(row).model_dump(mode="json")
            for row in result.scalars().all()
        ]

    message = (
        f"Saved {len(inserted)} class record(s)."
        if not errors
        else f"Saved {len(inserted)} record(s); {len(errors)} duplicate(s) skipped."
    )

    logger.info("User %s created %d classes (%d skipped).", user["id"], len(inserted), len(errors))
    return {
        "status": "success" if not errors else "partial",
        "message": message,
        "inserted": inserted,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# GET /classes - list with instant search + pagination + sorting
# ---------------------------------------------------------------------------
@router.get(
    "",
    summary="List classes",
    description="Returns paginated classes optionally filtered by a search term "
                "that matches class name, short code or section, and sorted by "
                "a chosen column and direction."
)
async def list_classes(
    search: Optional[str] = Query(None, description="Search class name, short code or section"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Records per page"),
    sort_by: Optional[str] = Query("created_at", description="Sort column: class_name, short_code, section or created_at"),
    order: Optional[str] = Query("desc", description="Sort direction: asc or desc"),
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    List classes owned by all authenticated users, with search + pagination.

    Args:
        search (Optional[str]): Case-insensitive filter.
        page (int): 1-indexed page number.
        per_page (int): Page size.
        sort_by (Optional[str]): Column to sort by.
        order (Optional[str]): "asc" or "desc".
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Paginated records plus totals for the table footer.
    """
    base_query = select(Class)
    count_query = select(func.count()).select_from(Class)

    if search:
        term = f"%{search.strip()}%"
        condition = or_(
            Class.class_name.ilike(term),
            Class.short_code.ilike(term),
            Class.section.ilike(term),
        )
        base_query = base_query.where(condition)
        count_query = count_query.where(condition)

    sortable = {
        "class_name": Class.class_name,
        "short_code": Class.short_code,
        "section": Class.section,
        "created_at": Class.created_at,
    }
    sort_column = sortable.get(sort_by, Class.created_at)
    descending = order == "desc"
    order_expr = sort_column.desc() if descending else sort_column.asc()
    tie_breaker = Class.id.desc() if descending else Class.id.asc()

    total = (await db.execute(count_query)).scalar_one()

    result = await db.execute(
        base_query
        .order_by(order_expr, tie_breaker)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = result.scalars().all()

    records = [ClassResponse.model_validate(row).model_dump(mode="json") for row in rows]

    return {
        "status": "success",
        "records": records,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page) if total else 1,
    }


# ---------------------------------------------------------------------------
# Helpers shared by update/delete
# ---------------------------------------------------------------------------

async def _get_class_or_404(db: AsyncSession, class_id: int) -> Class:
    """
    Load a class row by id, raising HTTP 404 when it does not exist.
    """
    row = await db.get(Class, class_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with id {class_id} was not found.",
        )
    return row


async def _ensure_unique(
    db: AsyncSession,
    class_name: str,
    short_code: str,
    section: str,
    exclude_id: int,
) -> None:
    """
    Verify (class_name, section) and (short_code, section) are not already
    taken by another class row, raising HTTP 409 on a conflict.
    """
    result = await db.execute(
        select(Class.id).where(
            or_(
                (Class.class_name == class_name) & (Class.section == section),
                (Class.short_code == short_code) & (Class.section == section),
            ),
            Class.id != exclude_id,
        )
    )
    conflicting = result.scalars().first()
    if conflicting is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Another class already uses this class name + section or "
                "short code + section."
            ),
        )


# ---------------------------------------------------------------------------
# PUT /classes/{id} - edit a class
# ---------------------------------------------------------------------------
@router.put(
    "/{class_id}",
    response_model=ClassResponse,
    summary="Edit a class",
    description="Updates one or more fields of an existing class. "
                "Uniqueness on (class_name, section) and (short_code, section) is enforced.",
)
async def update_class(
    class_id: int,
    payload: ClassUpdate,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Update a class row in place.

    Args:
        class_id (int): Id of the class to edit.
        payload (ClassUpdate): Optional class_name/short_code/section fields.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user (recorded as created_by).

    Returns:
        ClassResponse: The updated class row.
    """
    row = await _get_class_or_404(db, class_id)

    next_name = payload.class_name if payload.class_name is not None else row.class_name
    next_code = payload.short_code if payload.short_code is not None else row.short_code
    next_section = payload.section if payload.section is not None else row.section

    next_name = " ".join(next_name.split())
    next_code = " ".join(next_code.split()).upper()
    next_section = " ".join(next_section.split()).upper()

    await _ensure_unique(db, next_name, next_code, next_section, exclude_id=class_id)

    row.class_name = next_name
    row.short_code = next_code
    row.section = next_section

    try:
        await db.commit()
        await db.refresh(row)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to update class %s: %s", class_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update class: {exc}",
        )

    logger.info("User %s updated class %s.", user["id"], class_id)
    return ClassResponse.model_validate(row)


# ---------------------------------------------------------------------------
# DELETE /classes/{id} - delete a class
# ---------------------------------------------------------------------------
@router.delete(
    "/{class_id}",
    summary="Delete a class",
    description="Permanently removes a class by id.",
)
async def delete_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete a class row by id.

    Args:
        class_id (int): Id of the class to remove.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Confirmation message.
    """
    row = await _get_class_or_404(db, class_id)

    try:
        await db.delete(row)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete class %s: %s", class_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete class: {exc}",
        )

    logger.info("User %s deleted class %s.", user["id"], class_id)
    return {
        "status": "success",
        "message": "Class deleted successfully.",
        "deleted_id": class_id,
    }


# ---------------------------------------------------------------------------
# POST /classes/delete-batch - delete multiple classes
# ---------------------------------------------------------------------------
@router.post(
    "/delete-batch",
    summary="Delete multiple classes",
    description="Permanently removes several classes by id. Missing ids are "
                "reported instead of failing the whole batch. Rooms assigned to "
                "the deleted classes are unassigned (FK SET NULL) and generated "
                "timetable entries are removed (FK CASCADE).",
)
async def delete_classes_batch(
    payload: ClassBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete many class rows in one transaction.

    Args:
        payload (ClassBatchDeleteRequest): List of class ids to remove.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Counts of deleted rows and missing ids.
    """
    ids = list(dict.fromkeys(payload.ids))

    result = await db.execute(select(Class).where(Class.id.in_(ids)))
    rows = list(result.scalars().all())

    existing_ids = [row.id for row in rows]
    missing_ids = [rid for rid in ids if rid not in existing_ids]

    if not existing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="None of the selected classes exist.",
        )

    try:
        for row in rows:
            await db.delete(row)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete classes batch: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete classes: {exc}",
        )

    logger.info("User %s deleted %d class(es) in batch.", user["id"], len(existing_ids))
    return {
        "status": "success",
        "message": f"Deleted {len(existing_ids)} class(es).",
        "deleted_ids": existing_ids,
        "missing_ids": missing_ids,
    }


# ---------------------------------------------------------------------------
# POST /classes/delete-all - delete every class
# ---------------------------------------------------------------------------
@router.post(
    "/delete-all",
    summary="Delete all classes",
    description="Permanently removes every class. Rooms assigned to the deleted "
                "classes are unassigned (FK SET NULL) and generated timetable "
                "entries are removed (FK CASCADE).",
)
async def delete_all_classes(
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete every class row.

    Args:
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Total rows and how many were deleted.
    """
    result = await db.execute(select(func.count()).select_from(Class))
    total = result.scalar_one()

    if total == 0:
        return {
            "status": "success",
            "message": "No classes to delete.",
            "total": 0,
            "deleted": 0,
        }

    try:
        result = await db.execute(select(Class))
        rows = list(result.scalars().all())
        for row in rows:
            await db.delete(row)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete all classes: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete all classes: {exc}",
        )

    logger.info("User %s deleted all classes (%d).", user["id"], total)
    return {
        "status": "success",
        "message": f"Deleted {total} class(es).",
        "total": total,
        "deleted": total,
    }
