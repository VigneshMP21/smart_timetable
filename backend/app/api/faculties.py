"""
Purpose: Add Faculty API Router
Author: Smart Timetable Backend Team
Module Description: Exposes the Add Faculty module endpoints.

Endpoints:
  POST /faculties/upload  - Parse + validate an Excel file, return a preview.
  POST /faculties/create  - Insert one faculty assignment (manual) or a batch
                            (Excel save step).
  GET  /faculties         - List faculty assignments with instant search +
                            pagination + sorting (joined with subjects).
  PUT  /faculties/{id}    - Edit a faculty assignment.
  DELETE /faculties/{id}  - Delete a faculty assignment.
  POST /faculties/delete-batch - Delete multiple faculty assignments at once.
  POST /faculties/delete-all   - Delete every faculty assignment.

Workflow (Excel):
  upload -> validate Excel -> resolve subjects -> validate branches ->
  preview records -> create (save) -> success.

Excel format:
  Expected columns: Faculty Name, Subject Name, Classes / Branch.
  Classes / Branch holds comma-separated "CODE-SECTION" tokens (e.g.
  "CSE-1, CSM-2") where the section belongs to that branch. Codes without a
  section (e.g. "CSE") apply to every section of the branch. Tokens are
  validated against the classes table. Subject Name is matched
  case-insensitively against the subjects table.

Database interaction:
  Each row stores subject_id (FK -> subjects.id) and branch_classes (text[])
  holding combined "CODE-SECTION" tokens. The section column is kept only for
  legacy rows; new rows store the section inside each branch token. All writes
  set created_by to the authenticated user (JWT). The unique index on
  (lower(faculty_name), subject_id) prevents assigning the same faculty to the
  same subject more than once.
"""

import re
import uuid
from io import BytesIO
from typing import Any, Dict, List, Optional, Set, Tuple

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.models.class_model import Class
from app.models.faculty_model import Faculty
from app.models.subject_model import Subject
from app.schemas.faculty_schema import (
    CreateFacultiesRequest,
    FacultyBatchDeleteRequest,
    FacultyCreate,
    FacultyRecord,
    FacultyResponse,
    FacultyUpdate,
    FacultyUploadResult,
)
from app.services.class_utils import split_branch_token
from app.utils.exceptions import ExcelValidationError
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/faculties", tags=["Faculties"])

# Allowed spreadsheet extensions and the maximum accepted upload size.
ALLOWED_EXTENSIONS = (".xlsx", ".xls")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

MIN_FACULTY_NAME_LENGTH = 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_header(value: str) -> str:
    """
    Normalize a header label so column aliases can be matched reliably.

    "Classes / Branch" -> "classesbranch"
    """
    return re.sub(r"[^a-z]+", "", str(value).strip().lower())


def _map_columns(columns: List[str]) -> Dict[str, str]:
    """
    Map the raw Excel columns to the canonical record keys.

    Returns:
        Dict[str, str]: {canonical_key: actual_column_name}
    """
    mapping: Dict[str, str] = {}
    name_aliases = {"facultyname", "name", "faculty", "teacher", "staff"}
    subject_aliases = {"subjectname", "name", "subject", "subjecttitle", "title"}
    branch_aliases = {"classesbranch", "classes", "branch", "class", "classcodes", "branchclass", "branches"}

    for col in columns:
        key = _normalize_header(col)
        if "faculty_name" not in mapping and (key in name_aliases or key.startswith("faculty")):
            mapping["faculty_name"] = col
        elif "subject_name" not in mapping and (key in subject_aliases or key.startswith("subject")):
            mapping["subject_name"] = col
        elif "branch_classes" not in mapping and (
            key in branch_aliases or key.startswith("branch") or key.startswith("class") or "class" in key
        ):
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
    Split a "Classes / Branch" cell into normalized branch tokens.

    Each token may be a plain short code or a combined "CODE-SECTION" value.

    "CSE-1, ece-2 , AI-ML" -> ["CSE-1", "ECE-2", "AI-ML"]
    """
    seen: Set[str] = set()
    result: List[str] = []
    for part in re.split(r"[,;/]+", value):
        code = " ".join(part.split()).upper()
        if code and code not in seen:
            seen.add(code)
            result.append(code)
    return result


async def _fetch_valid_branch_codes(db: AsyncSession) -> Set[str]:
    """
    Load the distinct class short codes that a faculty can be assigned to.

    Returns:
        Set[str]: Uppercased short codes from the classes table.
    """
    result = await db.execute(select(Class.short_code))
    return {r[0].strip().upper() for r in result.all()}


async def _fetch_valid_class_keys(db: AsyncSession) -> Set[Tuple[str, str]]:
    """
    Load the distinct (short_code, section) pairs from the classes table.

    Returns:
        Set[Tuple[str, str]]: Uppercased (short code, section) pairs.
    """
    result = await db.execute(select(Class.short_code, Class.section))
    return {(r[0].strip().upper(), r[1].strip().upper()) for r in result.all()}


async def _resolve_subject(
    db: AsyncSession,
    subject_name: Optional[str],
    subject_id: Optional[uuid.UUID],
) -> Tuple[Optional[Subject], List[str]]:
    """
    Resolve the exact subject row for a record.

    When subject_id is provided it is used directly (manual entry path).
    Otherwise the human-readable subject_name is matched case-insensitively
    against the subjects table (Excel path). The most recently created match
    wins when several subjects share a name.

    Returns:
        Tuple[Optional[Subject], List[str]]: The subject row (or None) plus
            any validation errors.
    """
    errors: List[str] = []

    if subject_id is not None:
        subject = await db.get(Subject, subject_id)
        if subject is None:
            errors.append("The selected subject no longer exists. Please pick another subject.")
        return subject, errors

    if not subject_name:
        errors.append("Subject name is required.")
        return None, errors

    result = await db.execute(
        select(Subject)
        .where(func.lower(Subject.subject_name) == subject_name.lower())
        .order_by(Subject.created_at.desc(), Subject.id.desc())
        .limit(1)
    )
    subject = result.scalars().first()
    if subject is None:
        errors.append(
            f"Subject '{subject_name}' was not found. Add it in the Subjects module first."
        )
    return subject, errors


def _existing_key(faculty_name: str, subject: Any, subject_name: str) -> Tuple[str, Any]:
    """
    Build the duplicate-detection key for a record.

    The key uses the resolved subject id when available and falls back to the
    subject name (for rows whose subject failed to resolve, so in-file
    duplicates are still flagged). `subject` may be a Subject model instance or
    a raw subject id (UUID), depending on the caller.

    Returns:
        Tuple[str, Any]: (lowercased faculty name, subject id or lowercased name).
    """
    if subject is not None:
        subject_id = getattr(subject, "id", subject)
        return (faculty_name.lower(), subject_id)
    return (faculty_name.lower(), f"name:{subject_name.lower()}")


def _validate_branches(
    branches: List[str],
    valid_codes: Set[str],
    valid_class_keys: Set[Tuple[str, str]],
    row_label: str,
) -> List[str]:
    """
    Validate combined branch tokens against the classes table.

    Each token is either a plain short code ("CSE", matches every section) or
    a combined "CODE-SECTION" token ("CSE-1"). Codes must exist in the Classes
    module; when a section is supplied the (code, section) pair must exist too.

    Returns:
        List[str]: Per-row error messages (empty when all tokens are valid).
    """
    errors: List[str] = []
    unknown_codes: List[str] = []
    missing_classes: List[str] = []

    for token in branches:
        code, section = split_branch_token(token)
        if code not in valid_codes:
            unknown_codes.append(code)
        elif section is not None and (code, section) not in valid_class_keys:
            missing_classes.append(f'"{code}" with Section "{section}"')

    if unknown_codes:
        errors.append(
            f"{row_label}: Unknown branch code(s) {', '.join(sorted(set(unknown_codes)))}. "
            "Use short codes that exist in the Classes module (e.g. CSE, ECE)."
        )
    if missing_classes:
        errors.append(
            f"{row_label}: Class(es) not found in the Classes module: "
            f"{', '.join(missing_classes)}. Add the class/section first or fix the branch-section entry."
        )
    return errors


# ---------------------------------------------------------------------------
# POST /faculties/upload - parse + validate + preview (no DB write)
# ---------------------------------------------------------------------------
@router.post(
    "/upload",
    response_model=FacultyUploadResult,
    summary="Upload and validate a faculty Excel file",
    description="Parses a .xlsx/.xls file with Faculty Name / Subject Name / "
                "Classes-Branch columns, validates every row against the "
                "subjects and classes tables, and returns a preview of the "
                "records. Nothing is saved."
)
async def upload_faculties(
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
        FacultyUploadResult: Parsed records (with per-row errors) and error count.
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
        logger.error("Failed to parse faculties Excel: %s", exc)
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
            ("Faculty Name", "faculty_name"),
            ("Subject Name", "subject_name"),
            ("Classes / Branch", "branch_classes"),
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
                        f"Expected 'Faculty Name', 'Subject Name' and 'Classes / Branch'."
                    )
                }
            ],
        )

    valid_branch_codes = await _fetch_valid_branch_codes(db)
    valid_class_keys = await _fetch_valid_class_keys(db)

    records: List[FacultyRecord] = []
    for row_index, row in df.iterrows():
        faculty_name = _clean(row[mapping["faculty_name"]])
        subject_name = _clean(row[mapping["subject_name"]])
        branch_cell = _clean(row[mapping["branch_classes"]])
        branches = _parse_branches(branch_cell)

        # Skip entirely empty rows.
        if not faculty_name and not subject_name and not branches:
            continue

        row_label = f"Row {row_index + 2}"
        errors: List[str] = []

        if not faculty_name:
            errors.append(f"{row_label}: Faculty name is required.")
        elif len(faculty_name) < MIN_FACULTY_NAME_LENGTH:
            errors.append(f"{row_label}: Faculty name must be at least {MIN_FACULTY_NAME_LENGTH} characters.")
        if not subject_name:
            errors.append(f"{row_label}: Subject name is required.")
        if not branches:
            errors.append(f"{row_label}: At least one branch/class is required.")

        subject, resolve_errors = await _resolve_subject(db, subject_name or None, None)
        errors.extend(resolve_errors)

        if branches and valid_branch_codes:
            errors.extend(_validate_branches(branches, valid_branch_codes, valid_class_keys, row_label))

        records.append(
            FacultyRecord(
                faculty_name=faculty_name,
                subject_name=subject_name,
                subject_id=subject.id if subject is not None else None,
                branch_classes=branches,
                errors=errors,
            )
        )

    if not records:
        raise ExcelValidationError(
            "No records found.",
            [{"error": "The workbook does not contain any faculty records."}],
        )

    # Flag duplicates already present in the database so the user can decide
    # before hitting "Save to database".
    existing = await _fetch_existing_keys(db)
    for record in records:
        if _existing_key(record.faculty_name, record.subject_id, record.subject_name) in existing:
            record.errors.append("This faculty is already assigned to this subject.")

    records = _format_errors(records)
    error_count = sum(1 for r in records if r.errors)

    logger.info("Parsed %d faculty records (%d with errors).", len(records), error_count)
    return FacultyUploadResult(
        status="success" if error_count == 0 else "partial",
        message=(
            f"File parsed successfully. {len(records)} record(s) ready for review."
            if error_count == 0
            else f"File parsed with {error_count} record(s) needing attention."
        ),
        records=records,
        error_count=error_count,
    )


async def _fetch_existing_keys(db: AsyncSession) -> Set[Tuple[str, Any]]:
    """
    Load the current assignment keys from the DB.

    Returns:
        Set[Tuple[str, Any]]: {(lowercased faculty name, subject_id), ...}
    """
    result = await db.execute(select(Faculty.faculty_name, Faculty.subject_id))
    return {(r[0].lower(), r[1]) for r in result.all()}


def _format_errors(rows: List[FacultyRecord]) -> List[FacultyRecord]:
    """
    Mark in-file duplicates so the preview shows the conflicting rows.
    """
    seen: Set[Tuple[str, Any]] = set()

    for record in rows:
        key = _existing_key(record.faculty_name, record.subject_id, record.subject_name)
        if key in seen:
            record.errors.append("Duplicate faculty + subject assignment within the file.")
        else:
            seen.add(key)

    return rows


# ---------------------------------------------------------------------------
# POST /faculties/create - manual single entry OR batch save from preview
# ---------------------------------------------------------------------------
@router.post(
    "/create",
    summary="Create one or more faculty assignments",
    description="Inserts a single faculty assignment (manual entry) or a batch "
                "of assignments (Excel save step). Duplicate faculty + subject "
                "assignments are skipped with error details."
)
async def create_faculties(
    payload: CreateFacultiesRequest,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Insert faculty assignments into the database.

    Args:
        payload (CreateFacultiesRequest): Either {records: [...]} or a single
            {faculty_name, subject_id/subject_name, branch_classes} object.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user (recorded as created_by).

    Returns:
        dict: Inserted rows plus per-record duplicate/validation errors.
    """
    # Resolve the list of records to persist.
    if payload.records is not None and len(payload.records) > 0:
        items = payload.records
    elif payload.faculty_name and (payload.subject_id or payload.subject_name):
        items = [
            FacultyCreate(
                faculty_name=payload.faculty_name,
                subject_name=payload.subject_name,
                subject_id=payload.subject_id,
                branch_classes=payload.branch_classes or [],
                section=payload.section,
            )
        ]
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either 'records' (batch) or faculty_name/subject/branch_classes (single).",
        )

    existing = await _fetch_existing_keys(db)
    valid_branch_codes = await _fetch_valid_branch_codes(db)
    valid_class_keys = await _fetch_valid_class_keys(db)
    batch_keys: Set[Tuple[str, Any]] = set()

    inserted: List[Dict[str, Any]] = []
    inserted_ids: List[str] = []
    pending_rows: List[Faculty] = []
    errors: List[Dict[str, Any]] = []

    for item in items:
        faculty_name = item.faculty_name
        branches = item.branch_classes

        subject, resolve_errors = await _resolve_subject(db, item.subject_name, item.subject_id)

        per_row_errors: List[str] = []
        if len(faculty_name) < MIN_FACULTY_NAME_LENGTH:
            per_row_errors.append(f"Faculty name must be at least {MIN_FACULTY_NAME_LENGTH} characters.")
        if not branches:
            per_row_errors.append("Select at least one branch/class.")
        if valid_branch_codes:
            per_row_errors.extend(_validate_branches(branches, valid_branch_codes, valid_class_keys, "Faculty"))
        per_row_errors.extend(resolve_errors)

        if per_row_errors:
            errors.append({
                "faculty_name": faculty_name,
                "subject_name": item.subject_name or (subject.subject_name if subject else ""),
                "subject_id": str(subject.id) if subject is not None else None,
                "branch_classes": branches,
                "error": "; ".join(per_row_errors),
            })
            continue

        key = (faculty_name.lower(), subject.id)
        if key in existing or key in batch_keys:
            errors.append({
                "faculty_name": faculty_name,
                "subject_name": subject.subject_name,
                "subject_id": str(subject.id),
                "branch_classes": branches,
                "error": "This faculty is already assigned to this subject.",
            })
            continue

        row = Faculty(
            faculty_name=faculty_name,
            subject_id=subject.id,
            branch_classes=branches,
            section=None,
            created_by=uuid.UUID(str(user["id"])),
        )
        db.add(row)
        pending_rows.append(row)

        existing.add(key)
        batch_keys.add(key)

    try:
        if pending_rows:
            await db.flush()
        inserted_ids = [row.id for row in pending_rows]
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to insert faculties: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save faculty records: {exc}",
        )

    # Re-select inserted rows so serialized ids/timestamps/subject names are accurate.
    if inserted_ids:
        result = await db.execute(
            select(Faculty, Subject.subject_name, Subject.subject_code)
            .join(Subject, Subject.id == Faculty.subject_id)
            .where(Faculty.id.in_(inserted_ids))
        )
        inserted = [
            FacultyResponse(
                id=f.id,
                faculty_name=f.faculty_name,
                subject_id=f.subject_id,
                subject_code=sc,
                subject_name=sn,
                branch_classes=f.branch_classes,
                section=f.section,
                created_by=f.created_by,
                created_at=f.created_at,
                updated_at=f.updated_at,
            ).model_dump(mode="json")
            for f, sn, sc in result.all()
        ]

    message = (
        f"Saved {len(inserted)} faculty record(s)."
        if not errors
        else f"Saved {len(inserted)} record(s); {len(errors)} record(s) skipped."
    )

    logger.info("User %s created %d faculty records (%d skipped).", user["id"], len(inserted), len(errors))
    return {
        "status": "success" if not errors else "partial",
        "message": message,
        "inserted": inserted,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# GET /faculties - list with instant search + pagination + sorting
# ---------------------------------------------------------------------------
@router.get(
    "",
    summary="List faculty assignments",
    description="Returns paginated faculty assignments optionally filtered by a "
                "search term that matches the faculty name, subject name/code or "
                "branch/class codes, and sorted by a chosen column and direction."
)
async def list_faculties(
    search: Optional[str] = Query(None, description="Search faculty name, subject name/code or branch/class"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Records per page"),
    sort_by: Optional[str] = Query("created_at", description="Sort column: faculty_name, subject_name or created_at"),
    order: Optional[str] = Query("desc", description="Sort direction: asc or desc"),
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    List faculty assignments joined with their subject, with search + pagination.

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
    base_query = select(Faculty, Subject.subject_name, Subject.subject_code).join(
        Subject, Subject.id == Faculty.subject_id
    )
    count_query = (
        select(func.count())
        .select_from(Faculty)
        .join(Subject, Subject.id == Faculty.subject_id)
    )

    if search:
        term = search.strip()
        like_term = f"%{term}%"
        condition = or_(
            Faculty.faculty_name.ilike(like_term),
            Subject.subject_name.ilike(like_term),
            Subject.subject_code.ilike(like_term),
            func.array_to_string(Faculty.branch_classes, ",").ilike(like_term),
            Faculty.section.ilike(like_term),
        )
        base_query = base_query.where(condition)
        count_query = count_query.where(condition)

    sortable = {
        "faculty_name": Faculty.faculty_name,
        "subject_name": Subject.subject_name,
        "section": Faculty.section,
        "created_at": Faculty.created_at,
    }
    sort_column = sortable.get(sort_by, Faculty.created_at)
    descending = order == "desc"
    order_expr = sort_column.desc() if descending else sort_column.asc()
    tie_breaker = Faculty.id.desc() if descending else Faculty.id.asc()

    total = (await db.execute(count_query)).scalar_one()

    result = await db.execute(
        base_query
        .order_by(order_expr, tie_breaker)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = result.all()

    records = [
        FacultyResponse(
            id=f.id,
            faculty_name=f.faculty_name,
            subject_id=f.subject_id,
            subject_code=sc,
            subject_name=sn,
            branch_classes=f.branch_classes,
            section=f.section,
            created_by=f.created_by,
            created_at=f.created_at,
            updated_at=f.updated_at,
        ).model_dump(mode="json")
        for f, sn, sc in rows
    ]

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

async def _get_faculty_or_404(db: AsyncSession, faculty_id: str) -> Faculty:
    """
    Load a faculty row by id, raising HTTP 404 when it does not exist.
    """
    row = await db.get(Faculty, faculty_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty assignment with id {faculty_id} was not found.",
        )
    return row


async def _ensure_unique_assignment(
    db: AsyncSession,
    faculty_name: str,
    subject_id: uuid.UUID,
    exclude_id: str,
) -> None:
    """
    Verify the faculty is not already assigned to the same subject by another
    row, raising HTTP 409 on a conflict.
    """
    result = await db.execute(
        select(Faculty.id).where(
            func.lower(Faculty.faculty_name) == faculty_name.lower(),
            Faculty.subject_id == subject_id,
            Faculty.id != exclude_id,
        )
    )
    conflicting = result.scalars().first()
    if conflicting is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This faculty is already assigned to this subject.",
        )


# ---------------------------------------------------------------------------
# PUT /faculties/{id} - edit a faculty assignment
# ---------------------------------------------------------------------------
@router.put(
    "/{faculty_id}",
    response_model=FacultyResponse,
    summary="Edit a faculty assignment",
    description="Updates one or more fields of an existing faculty assignment. "
                "The faculty + subject uniqueness rule is enforced.",
)
async def update_faculty(
    faculty_id: str,
    payload: FacultyUpdate,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Update a faculty assignment row in place.

    Args:
        faculty_id (str): Id of the assignment to edit.
        payload (FacultyUpdate): Optional faculty_name/subject_id/branch_classes.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        FacultyResponse: The updated faculty assignment (with subject details).
    """
    row = await _get_faculty_or_404(db, faculty_id)

    if "faculty_name" in payload.model_fields_set and payload.faculty_name is not None:
        row.faculty_name = payload.faculty_name

    if "subject_id" in payload.model_fields_set and payload.subject_id is not None:
        subject = await db.get(Subject, payload.subject_id)
        if subject is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The selected subject does not exist.",
            )
        row.subject_id = payload.subject_id

    if "branch_classes" in payload.model_fields_set and payload.branch_classes is not None:
        valid_branch_codes = await _fetch_valid_branch_codes(db)
        valid_class_keys = await _fetch_valid_class_keys(db)
        branch_errors = _validate_branches(
            payload.branch_classes, valid_branch_codes, valid_class_keys, "Faculty"
        )
        if branch_errors:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="; ".join(branch_errors),
            )
        row.branch_classes = payload.branch_classes
        row.section = None

    await _ensure_unique_assignment(db, row.faculty_name, row.subject_id, exclude_id=faculty_id)

    try:
        await db.commit()
        await db.refresh(row)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to update faculty %s: %s", faculty_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update faculty record: {exc}",
        )

    result = await db.execute(
        select(Faculty, Subject.subject_name, Subject.subject_code)
        .join(Subject, Subject.id == Faculty.subject_id)
        .where(Faculty.id == faculty_id)
    )
    f, sn, sc = result.one()

    logger.info("User %s updated faculty assignment %s.", user["id"], faculty_id)
    return FacultyResponse(
        id=f.id,
        faculty_name=f.faculty_name,
        subject_id=f.subject_id,
        subject_code=sc,
        subject_name=sn,
        branch_classes=f.branch_classes,
        section=f.section,
        created_by=f.created_by,
        created_at=f.created_at,
        updated_at=f.updated_at,
    )


# ---------------------------------------------------------------------------
# DELETE /faculties/{id} - delete a faculty assignment
# ---------------------------------------------------------------------------
@router.delete(
    "/{faculty_id}",
    summary="Delete a faculty assignment",
    description="Permanently removes a faculty assignment by id. Any timetable "
                "entries referencing the assignment are removed via the FK cascade.",
)
async def delete_faculty(
    faculty_id: str,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete a faculty assignment row by id.

    Args:
        faculty_id (str): Id of the assignment to remove.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Confirmation message.
    """
    row = await _get_faculty_or_404(db, faculty_id)

    try:
        await db.delete(row)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete faculty %s: %s", faculty_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete faculty record: {exc}",
        )

    logger.info("User %s deleted faculty assignment %s.", user["id"], faculty_id)
    return {
        "status": "success",
        "message": "Faculty assignment deleted successfully.",
        "deleted_id": faculty_id,
    }


# ---------------------------------------------------------------------------
# POST /faculties/delete-batch - delete multiple faculty assignments
# ---------------------------------------------------------------------------
@router.post(
    "/delete-batch",
    summary="Delete multiple faculty assignments",
    description="Permanently removes several faculty assignments by id. Missing "
                "ids are reported instead of failing the whole batch.",
)
async def delete_faculties_batch(
    payload: FacultyBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete many faculty assignment rows in one transaction.

    Args:
        payload (FacultyBatchDeleteRequest): List of assignment ids to remove.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Counts of deleted rows and missing ids.
    """
    ids = list(dict.fromkeys([str(rid) for rid in payload.ids]))

    result = await db.execute(select(Faculty.id).where(Faculty.id.in_(ids)))
    existing_ids = [str(row_id) for row_id in result.scalars().all()]
    missing_ids = [rid for rid in ids if rid not in existing_ids]

    if not existing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="None of the selected faculty assignments exist.",
        )

    try:
        await db.execute(delete(Faculty).where(Faculty.id.in_(existing_ids)))
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete faculties batch: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete faculty records: {exc}",
        )

    logger.info(
        "User %s deleted %d faculty assignment(s) in batch.",
        user["id"],
        len(existing_ids),
    )
    return {
        "status": "success",
        "message": f"Deleted {len(existing_ids)} faculty assignment(s).",
        "deleted_ids": existing_ids,
        "missing_ids": missing_ids,
    }


# ---------------------------------------------------------------------------
# POST /faculties/delete-all - delete every faculty assignment
# ---------------------------------------------------------------------------
@router.post(
    "/delete-all",
    summary="Delete all faculty assignments",
    description="Permanently removes every faculty assignment. Timetable entries "
                "referencing them are removed via the FK cascade.",
)
async def delete_all_faculties(
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete every faculty assignment row.

    Args:
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Total rows and how many were deleted.
    """
    result = await db.execute(select(func.count()).select_from(Faculty))
    total = result.scalar_one()

    if total == 0:
        return {
            "status": "success",
            "message": "No faculty assignments to delete.",
            "total": 0,
            "deleted": 0,
        }

    try:
        await db.execute(delete(Faculty))
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete all faculties: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete all faculty records: {exc}",
        )

    logger.info("User %s deleted all faculty assignments (%d).", user["id"], total)
    return {
        "status": "success",
        "message": f"Deleted {total} faculty assignment(s).",
        "total": total,
        "deleted": total,
    }
