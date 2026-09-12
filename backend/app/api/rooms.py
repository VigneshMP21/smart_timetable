"""
Purpose: Add Room API Router
Author: Smart Timetable Backend Team
Module Description: Exposes the Add Room module endpoints.

Endpoints:
  POST /rooms/upload       - Parse + validate an Excel file, return a preview.
  POST /rooms/create       - Insert one room (manual) or a batch (Excel save).
  GET  /rooms              - List rooms with instant search + pagination.
  PUT  /rooms/{id}         - Edit a room.
  DELETE /rooms/{id}       - Delete a room.
  POST /rooms/delete-batch - Delete multiple rooms at once.
  POST /rooms/delete-all   - Delete every room.

Workflow (Excel):
  upload -> validate Excel -> preview records -> create (save) -> success.

Excel format:
  Expected columns: Room No, Class Short Code, Section.
  Room No is required. Class Short Code and Section are optional columns; when
  a Section column is absent the rows fall back to the default section "A".

Database interaction:
  All writes set created_by to the authenticated user (JWT) and respect the
  unique room_no constraint. Deleting a room is blocked while the room number
  is still referenced by generated timetable entries.
"""

import re
import uuid
from io import BytesIO
from typing import Any, Dict, List, Optional, Set

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.models.class_model import Class
from app.models.room_model import Room
from app.models.timetable_model import TimetableEntry
from app.schemas.room_schema import (
    CreateRoomsRequest,
    RoomBatchDeleteRequest,
    RoomCreate,
    RoomRecord,
    RoomResponse,
    RoomUpdate,
    RoomUploadResult,
)
from app.services.class_utils import DEFAULT_SECTION
from app.utils.exceptions import ExcelValidationError
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/rooms", tags=["Rooms"])

# Allowed spreadsheet extensions and the maximum accepted upload size.
ALLOWED_EXTENSIONS = (".xlsx", ".xls")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_header(value: str) -> str:
    """
    Normalize a header label so column aliases can be matched reliably.

    "Room No." -> "roomno"
    """
    return re.sub(r"[^a-z]+", "", str(value).strip().lower())


def _map_columns(columns: List[str]) -> Dict[str, str]:
    """
    Map the raw Excel columns to the canonical record keys.

    Returns:
        Dict[str, str]: {canonical_key: actual_column_name}
    """
    mapping: Dict[str, str] = {}
    room_aliases = {"roomno", "room", "roomnumber", "roomnum", "roomcode", "no", "number"}
    code_aliases = {"classshortcode", "shortcode", "short", "code", "classcode"}
    section_aliases = {"section", "sec", "roomsection"}

    for col in columns:
        key = _normalize_header(col)
        if "room_no" not in mapping and (key in room_aliases or "room" in key):
            mapping["room_no"] = col
        elif "class_short_code" not in mapping and (
            key in code_aliases or "shortcode" in key or "classcode" in key
        ):
            mapping["class_short_code"] = col
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


def _normalize_record(item: RoomCreate) -> str:
    """
    Normalize a RoomCreate into a canonical room_no string.
    """
    return " ".join(item.room_no.split()).upper()


# ---------------------------------------------------------------------------
# POST /rooms/upload - parse + validate + preview (no DB write)
# ---------------------------------------------------------------------------
@router.post(
    "/upload",
    response_model=RoomUploadResult,
    summary="Upload and validate a rooms Excel file",
    description="Parses a .xlsx/.xls file with a Room No column, validates it, "
                "and returns a preview of the records. Nothing is saved."
)
async def upload_rooms(
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
        RoomUploadResult: Parsed records (with per-row errors) and error count.
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
        logger.error("Failed to parse rooms Excel: %s", exc)
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

    if "room_no" not in mapping:
        raise ExcelValidationError(
            "Invalid columns.",
            [{"error": "Missing required column 'Room No'. Expected a 'Room No' header."}],
        )

    # Optional columns. When the Section column is absent entirely, fall back
    # to the default section so legacy room-only files keep working.
    has_code_column = "class_short_code" in mapping
    has_section_column = "section" in mapping
    default_section = DEFAULT_SECTION if not has_section_column else None

    records: List[RoomRecord] = []
    for row_index, row in df.iterrows():
        room_no = _clean(row[mapping["room_no"]])
        class_short_code = (
            _clean(row[mapping["class_short_code"]]) if has_code_column else ""
        )
        section = (
            _clean(row[mapping["section"]]) if has_section_column else default_section
        )

        # Skip entirely empty rows.
        if not room_no and not class_short_code and not section:
            continue

        errors: List[str] = []
        if not room_no:
            errors.append(f"Row {row_index + 2}: Room No is required.")

        records.append(
            RoomRecord(
                room_no=room_no.upper(),
                class_short_code=class_short_code.upper() if class_short_code else None,
                section=section.upper() if section else None,
                errors=errors,
            )
        )

    if not records:
        raise ExcelValidationError(
            "No records found.",
            [{"error": "The workbook does not contain any room records."}],
        )

    # Flag duplicates that already exist in the database so the user can
    # decide before hitting "Save to database".
    existing = await _fetch_existing_rooms(db)
    for record in records:
        if record.room_no.lower() in existing:
            record.errors.append("This room number already exists.")

    records = _format_errors(records)
    error_count = sum(1 for r in records if r.errors)

    logger.info("Parsed %d room records (%d with errors).", len(records), error_count)
    return RoomUploadResult(
        status="success" if error_count == 0 else "partial",
        message=(
            f"File parsed successfully. {len(records)} record(s) ready for review."
            if error_count == 0
            else f"File parsed with {error_count} record(s) needing attention."
        ),
        records=records,
        error_count=error_count,
    )


async def _fetch_existing_rooms(db: AsyncSession) -> Set[str]:
    """
    Load the current unique room_no keys from the DB.

    Returns:
        Set[str]: Lowercased room numbers already present in the database.
    """
    result = await db.execute(select(Room.room_no))
    return {r[0].lower() for r in result.all()}


async def _validate_class_assignment(
    db: AsyncSession,
    class_id: int,
    exclude_room_id: Optional[int] = None,
) -> None:
    """
    Verify a class exists and is not already assigned to another room,
    raising HTTP 404/409 on failure.
    """
    class_row = await db.get(Class, class_id)
    if class_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with id {class_id} was not found.",
        )

    result = await db.execute(
        select(Room.id).where(
            Room.class_id == class_id,
            Room.id != (exclude_room_id if exclude_room_id is not None else -1),
        )
    )
    conflicting = result.scalars().first()
    if conflicting is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This class is already assigned to another room.",
        )


def _format_errors(rows: List[RoomRecord]) -> List[RoomRecord]:
    """
    Mark in-file duplicates so the preview shows the conflicting rows.
    """
    seen: Set[str] = set()

    for record in rows:
        key = record.room_no.lower()
        if key in seen:
            record.errors.append("Duplicate room number within the file.")
        else:
            seen.add(key)

    return rows


# ---------------------------------------------------------------------------
# POST /rooms/create - manual single entry OR batch save from preview
# ---------------------------------------------------------------------------
@router.post(
    "/create",
    summary="Create one or more rooms",
    description="Inserts a single room (manual entry) or a batch of rooms "
                "(Excel save step). Duplicates are skipped with error details."
)
async def create_rooms(
    payload: CreateRoomsRequest,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Insert room records into the database.

    Args:
        payload (CreateRoomsRequest): Either {records: [...]} or a single
            {room_no} object.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user (recorded as created_by).

    Returns:
        dict: Inserted rows plus per-record duplicate/validation errors.
    """
    # Resolve the list of records to persist.
    if payload.records is not None and len(payload.records) > 0:
        items = payload.records
    elif payload.room_no:
        items = [
            RoomCreate(
                room_no=payload.room_no,
                class_short_code=payload.class_short_code,
                section=payload.section,
                class_id=payload.class_id,
            )
        ]
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either 'records' (batch) or 'room_no' (single).",
        )

    existing = await _fetch_existing_rooms(db)
    batch: Set[str] = set()
    assigned_class_ids: Set[int] = set()

    inserted: List[Dict[str, Any]] = []
    inserted_ids: List[int] = []
    pending_rows: List[Room] = []
    errors: List[Dict[str, Any]] = []

    for item in items:
        room_no = _normalize_record(item)
        key = room_no.lower()
        class_id = getattr(item, "class_id", None)
        class_short_code = (
            " ".join(item.class_short_code.split()).upper()
            if item.class_short_code
            else None
        )
        section = (
            " ".join(item.section.split()).upper() if item.section else None
        )

        if key in existing or key in batch:
            errors.append({
                "room_no": room_no,
                "error": "Duplicate room number.",
            })
            continue

        if class_id is not None:
            await _validate_class_assignment(db, class_id)
            if class_id in assigned_class_ids:
                errors.append({
                    "room_no": room_no,
                    "error": "Class is already assigned to another room.",
                })
                continue
            assigned_class_ids.add(class_id)

        row = Room(
            room_no=room_no,
            class_short_code=class_short_code,
            section=section,
            class_id=class_id,
            created_by=uuid.UUID(str(user["id"])),
        )
        db.add(row)
        pending_rows.append(row)

        existing.add(key)
        batch.add(key)

    try:
        if pending_rows:
            await db.flush()
        inserted_ids = [row.id for row in pending_rows]
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to insert rooms: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save rooms: {exc}",
        )

    # Re-select inserted rows so serialized ids/timestamps are accurate.
    if inserted_ids:
        result = await db.execute(
            select(Room).where(Room.id.in_(inserted_ids)).order_by(Room.id)
        )
        inserted = [
            RoomResponse.model_validate(row).model_dump(mode="json")
            for row in result.scalars().all()
        ]

    message = (
        f"Saved {len(inserted)} room record(s)."
        if not errors
        else f"Saved {len(inserted)} record(s); {len(errors)} duplicate(s) skipped."
    )

    logger.info("User %s created %d rooms (%d skipped).", user["id"], len(inserted), len(errors))
    return {
        "status": "success" if not errors else "partial",
        "message": message,
        "inserted": inserted,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# GET /rooms - list with instant search + pagination + sorting
# ---------------------------------------------------------------------------
@router.get(
    "",
    summary="List rooms",
    description="Returns paginated rooms optionally filtered by a search term "
                "that matches the room number, and sorted by a chosen column "
                "and direction."
)
async def list_rooms(
    search: Optional[str] = Query(None, description="Search room number"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Records per page"),
    sort_by: Optional[str] = Query("created_at", description="Sort column: room_no or created_at"),
    order: Optional[str] = Query("desc", description="Sort direction: asc or desc"),
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    List rooms with search + pagination.

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
    base_query = select(Room, Class.class_name).outerjoin(Class, Room.class_id == Class.id)
    count_query = select(func.count()).select_from(Room)

    if search:
        term = f"%{search.strip()}%"
        condition = or_(
            Room.room_no.ilike(term),
            Room.class_short_code.ilike(term),
            Room.section.ilike(term),
        )
        base_query = base_query.where(condition)
        count_query = count_query.where(condition)

    sortable = {
        "room_no": Room.room_no,
        "class_short_code": Room.class_short_code,
        "section": Room.section,
        "created_at": Room.created_at,
    }
    sort_column = sortable.get(sort_by, Room.created_at)
    descending = order == "desc"
    order_expr = sort_column.desc() if descending else sort_column.asc()
    tie_breaker = Room.id.desc() if descending else Room.id.asc()

    total = (await db.execute(count_query)).scalar_one()

    result = await db.execute(
        base_query
        .order_by(order_expr, tie_breaker)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = result.all()

    records: List[Dict[str, Any]] = []
    for row, class_name in rows:
        record = RoomResponse.model_validate(row).model_dump(mode="json")
        record["class_name"] = class_name
        records.append(record)

    return {
        "status": "success",
        "records": records,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page) if total else 1,
    }


# ---------------------------------------------------------------------------
# PUT /rooms/{id} - edit a room
# ---------------------------------------------------------------------------
@router.put(
    "/{room_id}",
    response_model=RoomResponse,
    summary="Edit a room",
    description="Updates the room number of an existing room. "
                "Uniqueness on room_no is enforced.",
)
async def update_room(
    room_id: int,
    payload: RoomUpdate,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Update a room row in place.

    Args:
        room_id (int): Id of the room to edit.
        payload (RoomUpdate): Optional room_no field.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        RoomResponse: The updated room row.
    """
    row = await _get_room_or_404(db, room_id)

    # Use model_fields_set so "class_id absent" (leave unchanged) can be
    # distinguished from "class_id: null" (clear the assignment).
    if "room_no" in payload.model_fields_set:
        next_no = payload.room_no if payload.room_no is not None else row.room_no
        next_no = " ".join(next_no.split()).upper()
        await _ensure_unique(db, next_no, exclude_id=room_id)
        row.room_no = next_no

    if "class_short_code" in payload.model_fields_set:
        value = payload.class_short_code
        row.class_short_code = " ".join(value.split()).upper() if value else None

    if "section" in payload.model_fields_set:
        value = payload.section
        row.section = " ".join(value.split()).upper() if value else None

    if "class_id" in payload.model_fields_set:
        next_class_id = payload.class_id
        if next_class_id is not None:
            await _validate_class_assignment(db, next_class_id, exclude_room_id=room_id)
        row.class_id = next_class_id

    try:
        await db.commit()
        await db.refresh(row)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to update room %s: %s", room_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update room: {exc}",
        )

    logger.info("User %s updated room %s.", user["id"], room_id)
    return RoomResponse.model_validate(row)


async def _get_room_or_404(db: AsyncSession, room_id: int) -> Room:
    """
    Load a room row by id, raising HTTP 404 when it does not exist.
    """
    row = await db.get(Room, room_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room with id {room_id} was not found.",
        )
    return row


async def _ensure_unique(
    db: AsyncSession,
    room_no: str,
    exclude_id: int,
) -> None:
    """
    Verify room_no is not already taken by another room row, raising HTTP 409
    on a conflict.
    """
    result = await db.execute(
        select(Room.id).where(
            Room.room_no == room_no,
            Room.id != exclude_id,
        )
    )
    conflicting = result.scalars().first()
    if conflicting is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another room already uses this room number.",
        )


async def _ensure_no_timetable_refs(db: AsyncSession, room_numbers: List[str]) -> None:
    """
    Raise HTTP 409 when any of the given room numbers are referenced by a
    generated timetable entry, so partially built schedules are not orphaned.
    """
    if not room_numbers:
        return
    result = await db.execute(
        select(TimetableEntry.room_no).where(
            TimetableEntry.room_no.in_(room_numbers)
        )
    )
    referenced = set(result.scalars().all())
    if referenced:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot delete room(s) already used in the generated timetable: "
                + ", ".join(sorted(referenced))
            ),
        )


async def _blocked_room_numbers(db: AsyncSession, rows: List[Room]) -> Set[str]:
    """
    Return the subset of room numbers from `rows` that are still referenced by
    generated timetable entries. Used by batch/delete-all to skip, not fail.
    """
    room_numbers = [row.room_no for row in rows if row.room_no]
    if not room_numbers:
        return set()
    result = await db.execute(
        select(TimetableEntry.room_no).where(
            TimetableEntry.room_no.in_(room_numbers)
        )
    )
    return set(result.scalars().all())


def _natural_key(value: str) -> List[Any]:
    """
    Sort key that treats embedded numbers numerically so that
    "A-101, A-102, ..., A-110" order naturally instead of lexicographically.
    """
    return [
        int(part) if part.isdigit() else part.lower()
        for part in re.split(r"(\d+)", str(value))
    ]


# ---------------------------------------------------------------------------
# POST /rooms/auto-assign - automatically assign classes to rooms
# ---------------------------------------------------------------------------
@router.post(
    "/auto-assign",
    summary="Automatically assign classes to rooms",
    description="Assigns unassigned classes to unassigned rooms in a continuous "
                "manner: classes sorted by (class name, section) are paired with "
                "rooms sorted naturally by room number, so sections of the same "
                "class land in adjacent rooms (e.g. CSE-A -> A-101, CSE-B -> A-102). "
                "Existing assignments are left untouched."
)
async def auto_assign_classes(
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Automatically pair unassigned classes with unassigned rooms.

    Classes are ordered by class name then section, rooms are ordered by their
    natural room number. Both lists are zipped so consecutive classes receive
    consecutive rooms. Only unassigned entities participate, so previously
    manual assignments are preserved.

    Returns:
        dict: Summary of the assignments performed.
    """
    assigned_class_ids = (
        select(Room.class_id).where(Room.class_id.is_not(None))
    )

    class_result = await db.execute(
        select(Class)
        .where(Class.id.not_in(assigned_class_ids))
        .order_by(Class.class_name, Class.section)
    )
    unassigned_classes = class_result.scalars().all()

    room_result = await db.execute(
        select(Room).where(Room.class_id.is_(None))
    )
    unassigned_rooms = list(room_result.scalars().all())
    unassigned_rooms.sort(key=lambda room: _natural_key(room.room_no))

    pairs = min(len(unassigned_rooms), len(unassigned_classes))

    assigned: List[Dict[str, Any]] = []
    for index in range(pairs):
        room = unassigned_rooms[index]
        cls = unassigned_classes[index]
        room.class_id = cls.id
        assigned.append({
            "room_no": room.room_no,
            "room_id": room.id,
            "class_id": cls.id,
            "class_name": cls.class_name,
            "section": cls.section,
        })

    if assigned:
        try:
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.error("Failed to auto-assign classes to rooms: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to auto-assign classes: {exc}",
            )

    logger.info(
        "User %s auto-assigned %d class(es) to room(s).",
        user["id"],
        len(assigned),
    )
    return {
        "status": "success",
        "message": f"Assigned {len(assigned)} class(es) to {len(assigned)} room(s).",
        "assigned": assigned,
        "unassigned_classes": len(unassigned_classes) - pairs,
        "unassigned_rooms": len(unassigned_rooms) - pairs,
    }


# ---------------------------------------------------------------------------
# POST /rooms/unassign-all - clear every class assignment
# ---------------------------------------------------------------------------
@router.post(
    "/unassign-all",
    summary="Unassign all classes from rooms",
    description="Clears the class assignment from every room. "
                "Rooms and classes themselves are left intact."
)
async def unassign_all_classes(
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Remove the class assignment from every room.

    Args:
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Number of rooms whose assignment was cleared.
    """
    result = await db.execute(
        update(Room)
        .where(Room.class_id.is_not(None))
        .values(class_id=None)
    )
    await db.commit()
    cleared = result.rowcount or 0

    logger.info("User %s unassigned all classes (%d room(s)).", user["id"], cleared)
    return {
        "status": "success",
        "message": f"Cleared class assignments from {cleared} room(s).",
        "cleared": cleared,
    }


# ---------------------------------------------------------------------------
# DELETE /rooms/{id} - delete a room
# ---------------------------------------------------------------------------
@router.delete(
    "/{room_id}",
    summary="Delete a room",
    description="Permanently removes a room by id. Deletion is blocked while "
                "the room number is still referenced by generated timetable entries.",
)
async def delete_room(
    room_id: int,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete a room row by id, guarding against timetable dependencies.

    Args:
        room_id (int): Id of the room to remove.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Confirmation message.
    """
    row = await _get_room_or_404(db, room_id)
    await _ensure_no_timetable_refs(db, [row.room_no])

    try:
        await db.delete(row)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete room %s: %s", room_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete room: {exc}",
        )

    logger.info("User %s deleted room %s.", user["id"], room_id)
    return {
        "status": "success",
        "message": "Room deleted successfully.",
        "deleted_id": room_id,
    }


# ---------------------------------------------------------------------------
# POST /rooms/delete-batch - delete multiple rooms
# ---------------------------------------------------------------------------
@router.post(
    "/delete-batch",
    summary="Delete multiple rooms",
    description="Permanently removes several rooms by id. Rooms whose number is "
                "still referenced by generated timetable entries are skipped "
                "and reported instead of failing the whole batch.",
)
async def delete_rooms_batch(
    payload: RoomBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete many room rows in one transaction.

    Args:
        payload (RoomBatchDeleteRequest): List of room ids to remove.
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Counts of deleted rooms, missing ids and skipped ids, plus the
              room numbers that were blocked by timetable dependencies.
    """
    ids = list(dict.fromkeys(payload.ids))

    result = await db.execute(select(Room).where(Room.id.in_(ids)))
    rows = list(result.scalars().all())

    existing_ids = {row.id for row in rows}
    missing_ids = [rid for rid in ids if rid not in existing_ids]

    blocked_room_numbers = await _blocked_room_numbers(db, rows)

    deletable = [row for row in rows if row.room_no not in blocked_room_numbers]

    if not deletable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "None of the selected rooms can be deleted because they are "
                "referenced by the generated timetable."
            ),
        )

    try:
        for row in deletable:
            await db.delete(row)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete rooms batch: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete rooms: {exc}",
        )

    deleted_ids = [row.id for row in deletable]
    logger.info("User %s deleted %d room(s) in batch.", user["id"], len(deleted_ids))
    return {
        "status": "success",
        "message": f"Deleted {len(deleted_ids)} room(s).",
        "deleted_ids": deleted_ids,
        "missing_ids": missing_ids,
        "blocked_ids": [row.id for row in rows if row.room_no in blocked_room_numbers],
        "blocked_room_numbers": sorted(blocked_room_numbers),
    }


# ---------------------------------------------------------------------------
# POST /rooms/delete-all - delete every room
# ---------------------------------------------------------------------------
@router.post(
    "/delete-all",
    summary="Delete all rooms",
    description="Permanently removes every room. Rooms referenced by generated "
                "timetable entries are skipped and reported.",
)
async def delete_all_rooms(
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete every room row, skipping rooms still used by the timetable.

    Args:
        db (AsyncSession): Active database session.
        user (Dict[str, Any]): Authenticated user.

    Returns:
        dict: Total rooms and how many were deleted / skipped.
    """
    result = await db.execute(select(Room))
    rows = list(result.scalars().all())

    if not rows:
        return {
            "status": "success",
            "message": "No rooms to delete.",
            "total": 0,
            "deleted": 0,
            "skipped": 0,
        }

    blocked_room_numbers = await _blocked_room_numbers(db, rows)
    deletable = [row for row in rows if row.room_no not in blocked_room_numbers]

    try:
        for row in deletable:
            await db.delete(row)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete all rooms: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete all rooms: {exc}",
        )

    skipped = len(rows) - len(deletable)
    logger.info(
        "User %s deleted all rooms (%d deleted, %d skipped).",
        user["id"],
        len(deletable),
        skipped,
    )
    return {
        "status": "success",
        "message": f"Deleted {len(deletable)} room(s).",
        "total": len(rows),
        "deleted": len(deletable),
        "skipped": skipped,
        "blocked_room_numbers": sorted(blocked_room_numbers),
    }
