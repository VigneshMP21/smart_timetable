"""
Purpose: Add Subject API Router
Author: Smart Timetable Backend Team
Module Description: Exposes the Add Subject module endpoints.

Endpoints:
  POST /subjects/upload  - Parse + validate an Excel file, return a preview.
  POST /subjects/create  - Insert one subject (manual) or a batch (Excel save).
  GET  /subjects         - List subjects with instant search + pagination.
  PUT  /subjects/{id}    - Edit a subject.
  DELETE /subjects/{id}  - Delete a subject.

Workflow (Excel):
  upload -> validate Excel -> preview records -> create (save) -> success.

Excel format:
  Expected columns: Subject Code, Subject Name, Branch/Class.
  Branch/Class holds comma-separated class short codes (e.g. "CSE,ECE") that
  are validated against the classes table. subject_code is unique.

Database interaction:
  All writes set created_by to the authenticated user (JWT) and respect the
  unique subject_code constraint.
"""

import re
import uuid
from io import BytesIO
from typing import Any, Dict, List, Optional, Set

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.models.class_model import Class
from app.models.subject_model import Subject
from app.schemas.subject_schema import (
    CreateSubjectsRequest,
    SubjectBatchDeleteRequest,
    SubjectCreate,
    SubjectRecord,
    SubjectResponse,
    SubjectUpdate,
    SubjectUploadResult,
)
from app.utils.exceptions import ExcelValidationError
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/subjects", tags=["Subjects"])

# Allowed spreadsheet extensions and the maximum accepted upload size.
ALLOWED_EXTENSIONS = (".xlsx", ".xls")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_header(value: str) -> str:
    """
    Normalize a header label so column aliases can be matched reliably.

    "Subject Code" -> "subjectcode"
    """
    return re.sub(r"[^a-z]+", "", str(value).strip().lower())


def _map_columns(columns: List[str]) -> Dict[str, str]:
    """
    Map the raw Excel columns to the canonical record keys.

    Returns:
        Dict[str, str]: {canonical_key: actual_column_name}
    """
    mapping: Dict[str, str] = {}
    code_aliases = {"subjectcode", "subject", "code", "subjectid", "subjectno"}
    name_aliases = {"subjectname", "name", "subjecttitle", "title", "subject"}
    branch_aliases = {"branchclass", "branchclasses", "branch", "class", "classes", "classcodes", "branches"}

    for col in columns:
        key = _normalize_header(col)
        if "subject_code" not in mapping and (key in code_aliases or key.startswith("subjectcode")):
            mapping["subject_code"] = col
        elif "subject_name" not in mapping and (key in name_aliases or key.startswith("subjectname")):
            mapping["subject_name"] = col
        elif "branch_classes" not in mapping and (key in branch_aliases or key.startswith("branch") or "class" in key):
            mapping["branch_classes"] = col

    return mapping


def _clean(value: Any) -> str:
    """Convert a cell value to a cleaned string (empty for NaN/None)."""
    if value is None:
        return ""
    if pd.isna(value):
        return ""
    return str(value).strip()


def _parse_branches(value: str) -> List[str]:
    """
    Split a "Branch/Class" cell into normalized short codes.

    "CSE, ece , AI-ML" -> ["CSE", "ECE", "AI-ML"]
    """
    seen: Set[str] = set()
    result: List[str] = []
    for part in re.split(r"[,;/]+", value):
        code = " ".join(part.split()).upper()
        if code and code not in seen:
            seen.add(code)
            result.append(code)
    return result


def _normalize_record(item: SubjectCreate) -> tuple:
    """
    Normalize a SubjectCreate into (subject_code, subject_name, branch_classes)
    with canonical casing (codes/branches uppercased).
    """
    return (
        item.subject_code,
        item.subject_name,
        _parse_branches(", ".join(item.branch_classes)),
    )


async def _fetch_existing_codes(db: AsyncSession) -> Set[str]:
    """
    Load the current unique subject_code keys from the DB.

    Returns:
        Set[str]: Lowercased subject codes already present in the database.
    """
    result = await db.execute(select(Subject.subject_code))
    return {r[0].lower() for r in result.all()}


async def _fetch_valid_branch_codes(db: AsyncSession) -> Set[str]:
    """
    Load the distinct class short codes that can be assigned to a subject.

    Returns:
        Set[str]: Uppercased short codes from the classes table.
    """
    result = await db.execute(select(Class.short_code))
    return {r[0].strip().upper() for r in result.all()}


def _format_errors(rows: List[SubjectRecord]) -> List[SubjectRecord]:
    """
    Mark in-file duplicates so the preview shows the conflicting rows.
    """
    seen: Set[str] = set()

    for record in rows:
        key = record.subject_code.lower()
        if key in seen:
            record.errors.append("Duplicate subject code within the file.")
        else:
            seen.add(key)

    return rows


# ---------------------------------------------------------------------------
# POST /subjects/upload - parse + validate + preview (no DB write)
# ---------------------------------------------------------------------------
@router.post(
    "/upload",
    response_model=SubjectUploadResult,
    summary="Upload and validate a subjects Excel file",
    description="Parses a .xlsx/.xls file with Subject Code / Subject Name / "
                "Branch-Class columns, validates it, and returns a preview of "
                "the records. Nothing is saved."
)
async def upload_subjects(
    file: UploadFile = File(..., description="Excel file (.xlsx or .xls)"),
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Validate the spreadsheet shape and return preview records.

    Args:
        file (UploadFile): The Excel workbook.
        db (AsyncSession): Active database session (used for validation).
        user (Dict[str, Any]): Authenticated user from the JWT.

    Returns:
        SubjectUploadResult: Parsed records (with per-row errors) and error count.
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
        logger.error("Failed to parse subjects Excel: %s", exc)
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
        for name, key in (
            ("Subject Code", "subject_code"),
            ("Subject Name", "subject_name"),
            ("Branch/Class", "branch_classes"),
        )
        if key not in mapping
    ]
    if missing:
        raise ExcelValidationError(
            "Invalid columns.",
            [
                {
                    "error": (
                        f"Missing required column(s): {', '.join(missing)}. "
                        f"Expected 'Subject Code', 'Subject Name' and 'Branch/Class'."
                    )
                }
            ],
        )

    valid_branch_codes = await _fetch_valid_branch_codes(db)

    records: List[SubjectRecord] = []
    for row_index, row in df.iterrows():
        subject_code = _clean(row[mapping["subject_code"]])
        subject_name = _clean(row[mapping["subject_name"]])
        branch_cell = _clean(row[mapping["branch_classes"]])
        branches = _parse_branches(branch_cell)

        # Skip entirely empty rows.
        if not subject_code and not subject_name and not branches:
            continue

        errors: List[str] = []
        if not subject_code:
            errors.append(f"Row {row_index + 2}: Subject code is required.")
        if not subject_name:
            errors.append(f"Row {row_index + 2}: Subject name is required.")
        if not branches:
            errors.append(f"Row {row_index + 2}: At least one branch/class is required.")

        unknown = [code for code in branches if code not in valid_branch_codes]
        if unknown:
            errors.append(
                f"Row {row_index + 2}: Unknown branch code(s) {', '.join(unknown)}. "
                "Use short codes that exist in the Classes module (e.g. CSE, ECE)."
            )

        records.append(
            SubjectRecord(
                subject_code=subject_code.upper(),
                subject_name=subject_name,
                branch_classes=branches,
                errors=errors,
            )
        )

    if not records:
        raise ExcelValidationError(
            "No records found.",
            [{"error": "The workbook does not contain any subject records."}],
        )

    # Flag duplicates that already exist in the database so the user can
    # decide before hitting "Save to database".
    existing = await _fetch_existing_codes(db)
    for record in records:
        if record.subject_code.lower() in existing:
            record.errors.append("This subject code already exists.")

    records = _format_errors(records)
    error_count = sum(1 for r in records if r.errors)

    logger.info("Parsed %d subject records (%d with errors).", len(records), error_count)
    return SubjectUploadResult(
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
# POST /subjects/create - manual single entry OR batch save from preview
# ---------------------------------------------------------------------------
@router.post(
    "/create",
    summary="Create one or more subjects",
    description="Inserts a single subject (manual entry) or a batch of subjects "
                "(Excel save step). Duplicates are skipped with error details."
)
async def create_subjects(
    payload: CreateSubjectsRequest,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Insert subject records into the database.

    Args:
        payload (CreateSubjectsRequest): Either {records: [...]} or a single
            {subject_code, subject_name, branch_classes} object.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user (recorded as created_by).

    Returns:
        dict: Inserted rows plus per-record duplicate/validation errors.
    """
    # Resolve the list of records to persist.
    if payload.records is not None and len(payload.records) > 0:
        items = payload.records
    elif payload.subject_code and payload.subject_name:
        items = [
            SubjectCreate(
                subject_code=payload.subject_code,
                subject_name=payload.subject_name,
                branch_classes=payload.branch_classes or [],
            )
        ]
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either 'records' (batch) or subject_code/subject_name/branch_classes (single).",
        )

    existing = await _fetch_existing_codes(db)
    batch_codes: Set[str] = set()

    inserted: List[Dict[str, Any]] = []
    inserted_ids: List[str] = []
    pending_rows: List[Subject] = []
    errors: List[Dict[str, Any]] = []

    for item in items:
        subject_code, subject_name, branches = _normalize_record(item)
        key = subject_code.lower()

        if key in existing or key in batch_codes:
            errors.append({
                "subject_code": subject_code,
                "subject_name": subject_name,
                "branch_classes": branches,
                "error": "Duplicate subject code.",
            })
            continue

        row = Subject(
            subject_code=subject_code,
            subject_name=subject_name,
            branch_classes=branches,
            created_by=uuid.UUID(str(user["id"])),
        )
        db.add(row)
        pending_rows.append(row)

        existing.add(key)
        batch_codes.add(key)

    try:
        if pending_rows:
            await db.flush()
        inserted_ids = [row.id for row in pending_rows]
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to insert subjects: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save subjects: {exc}",
        )

    # Re-select inserted rows so serialized ids/timestamps are accurate.
    if inserted_ids:
        result = await db.execute(
            select(Subject).where(Subject.id.in_(inserted_ids))
        )
        inserted = [
            SubjectResponse.model_validate(row).model_dump(mode="json")
            for row in result.scalars().all()
        ]

    message = (
        f"Saved {len(inserted)} subject record(s)."
        if not errors
        else f"Saved {len(inserted)} record(s); {len(errors)} duplicate(s) skipped."
    )

    logger.info("User %s created %d subjects (%d skipped).", user["id"], len(inserted), len(errors))
    return {
        "status": "success" if not errors else "partial",
        "message": message,
        "inserted": inserted,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# GET /subjects - list with instant search + pagination + sorting
# ---------------------------------------------------------------------------
@router.get(
    "",
    summary="List subjects",
    description="Returns paginated subjects optionally filtered by a search term "
                "that matches the subject code, name or branch/class codes, and "
                "sorted by a chosen column and direction."
)
async def list_subjects(
    search: Optional[str] = Query(None, description="Search subject code, name or branch/class"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Records per page"),
    sort_by: Optional[str] = Query("created_at", description="Sort column: subject_code, subject_name or created_at"),
    order: Optional[str] = Query("desc", description="Sort direction: asc or desc"),
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    List subjects with search + pagination.

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
    base_query = select(Subject)
    count_query = select(func.count()).select_from(Subject)

    if search:
        term = search.strip()
        like_term = f"%{term}%"
        condition = or_(
            Subject.subject_code.ilike(like_term),
            Subject.subject_name.ilike(like_term),
            Subject.branch_classes.any(term.upper()),
        )
        base_query = base_query.where(condition)
        count_query = count_query.where(condition)

    sortable = {
        "subject_code": Subject.subject_code,
        "subject_name": Subject.subject_name,
        "created_at": Subject.created_at,
    }
    sort_column = sortable.get(sort_by, Subject.created_at)
    descending = order == "desc"
    order_expr = sort_column.desc() if descending else sort_column.asc()
    tie_breaker = Subject.id.desc() if descending else Subject.id.asc()

    total = (await db.execute(count_query)).scalar_one()

    result = await db.execute(
        base_query
        .order_by(order_expr, tie_breaker)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = result.scalars().all()

    records = [SubjectResponse.model_validate(row).model_dump(mode="json") for row in rows]

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

async def _get_subject_or_404(db: AsyncSession, subject_id: str) -> Subject:
    """
    Load a subject row by id, raising HTTP 404 when it does not exist.
    """
    row = await db.get(Subject, subject_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject with id {subject_id} was not found.",
        )
    return row


async def _ensure_unique(
    db: AsyncSession,
    subject_code: str,
    exclude_id: str,
) -> None:
    """
    Verify subject_code is not already taken by another subject row, raising
    HTTP 409 on a conflict.
    """
    result = await db.execute(
        select(Subject.id).where(
            Subject.subject_code == subject_code,
            Subject.id != exclude_id,
        )
    )
    conflicting = result.scalars().first()
    if conflicting is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another subject already uses this subject code.",
        )


# ---------------------------------------------------------------------------
# PUT /subjects/{id} - edit a subject
# ---------------------------------------------------------------------------
@router.put(
    "/{subject_id}",
    response_model=SubjectResponse,
    summary="Edit a subject",
    description="Updates one or more fields of an existing subject. "
                "Uniqueness on subject_code is enforced.",
)
async def update_subject(
    subject_id: str,
    payload: SubjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Update a subject row in place.

    Args:
        subject_id (str): Id of the subject to edit.
        payload (SubjectUpdate): Optional subject_code/subject_name/branch_classes.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        SubjectResponse: The updated subject row.
    """
    row = await _get_subject_or_404(db, subject_id)

    if "subject_code" in payload.model_fields_set and payload.subject_code is not None:
        next_code = payload.subject_code
        await _ensure_unique(db, next_code, exclude_id=subject_id)
        row.subject_code = next_code

    if "subject_name" in payload.model_fields_set and payload.subject_name is not None:
        row.subject_name = payload.subject_name

    if "branch_classes" in payload.model_fields_set and payload.branch_classes is not None:
        row.branch_classes = _parse_branches(", ".join(payload.branch_classes))

    try:
        await db.commit()
        await db.refresh(row)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to update subject %s: %s", subject_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update subject: {exc}",
        )

    logger.info("User %s updated subject %s.", user["id"], subject_id)
    return SubjectResponse.model_validate(row)


# ---------------------------------------------------------------------------
# DELETE /subjects/{id} - delete a subject
# ---------------------------------------------------------------------------
@router.delete(
    "/{subject_id}",
    summary="Delete a subject",
    description="Permanently removes a subject by id.",
)
async def delete_subject(
    subject_id: str,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete a subject row by id.

    Args:
        subject_id (str): Id of the subject to remove.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Confirmation message.
    """
    row = await _get_subject_or_404(db, subject_id)

    try:
        await db.delete(row)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete subject %s: %s", subject_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete subject: {exc}",
        )

    logger.info("User %s deleted subject %s.", user["id"], subject_id)
    return {
        "status": "success",
        "message": "Subject deleted successfully.",
        "deleted_id": subject_id,
    }


# ---------------------------------------------------------------------------
# POST /subjects/delete-batch - delete multiple subjects
# ---------------------------------------------------------------------------
@router.post(
    "/delete-batch",
    summary="Delete multiple subjects",
    description="Permanently removes several subjects by id. Missing ids are "
                "reported instead of failing the whole batch. Faculty assignments "
                "and generated timetable entries referencing the deleted subjects "
                "are removed via the FK cascade.",
)
async def delete_subjects_batch(
    payload: SubjectBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete many subject rows in one transaction.

    Args:
        payload (SubjectBatchDeleteRequest): List of subject ids to remove.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Counts of deleted rows and missing ids.
    """
    ids = list(dict.fromkeys([str(rid) for rid in payload.ids]))

    result = await db.execute(select(Subject).where(Subject.id.in_(ids)))
    rows = list(result.scalars().all())

    existing_ids = [str(row.id) for row in rows]
    missing_ids = [rid for rid in ids if rid not in existing_ids]

    if not existing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="None of the selected subjects exist.",
        )

    try:
        for row in rows:
            await db.delete(row)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete subjects batch: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete subjects: {exc}",
        )

    logger.info("User %s deleted %d subject(s) in batch.", user["id"], len(existing_ids))
    return {
        "status": "success",
        "message": f"Deleted {len(existing_ids)} subject(s).",
        "deleted_ids": existing_ids,
        "missing_ids": missing_ids,
    }


# ---------------------------------------------------------------------------
# POST /subjects/delete-all - delete every subject
# ---------------------------------------------------------------------------
@router.post(
    "/delete-all",
    summary="Delete all subjects",
    description="Permanently removes every subject. Faculty assignments and "
                "generated timetable entries referencing the deleted subjects "
                "are removed via the FK cascade.",
)
async def delete_all_subjects(
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete every subject row.

    Args:
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Total rows and how many were deleted.
    """
    result = await db.execute(select(func.count()).select_from(Subject))
    total = result.scalar_one()

    if total == 0:
        return {
            "status": "success",
            "message": "No subjects to delete.",
            "total": 0,
            "deleted": 0,
        }

    try:
        result = await db.execute(select(Subject))
        rows = list(result.scalars().all())
        for row in rows:
            await db.delete(row)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete all subjects: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete all subjects: {exc}",
        )

    logger.info("User %s deleted all subjects (%d).", user["id"], total)
    return {
        "status": "success",
        "message": f"Deleted {total} subject(s).",
        "total": total,
        "deleted": total,
    }
