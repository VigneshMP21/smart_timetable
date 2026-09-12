"""
Purpose: Smart Timetable Bulk Excel Import Service
Author: Smart Timetable Backend Team
Module Description: Implements the single-workbook import flow that replaces
the legacy configuration-format upload. A workbook is expected to contain
exactly four sheets (Classes, Rooms, Subjects, Faculty). The workbook is
validated fully (sheet presence, columns, cell values, cross-sheet
relationships) before a single database transaction is opened, so a bad file
never leaves partially-imported data behind.

Import order inside the transaction:
  1. Classes  (rooms/faculty reference classes by short code + section)
  2. Rooms    (assign class_id from classes)
  3. Subjects (faculty references subjects by subject code)
  4. Faculty

Duplicate handling reuses each module's existing unique keys:
  - Classes : (class_name, section) and (short_code, section)
  - Rooms   : room_no
  - Subjects: subject_code
  - Faculty : (lower(faculty_name), subject_id)
Duplicates are reported per sheet as "skipped" and never block the import.
"""

import re
import uuid
from io import BytesIO
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_model import Class
from app.models.faculty_model import Faculty
from app.models.room_model import Room
from app.models.subject_model import Subject
from app.services.class_utils import split_branch_token
from app.utils.exceptions import ExcelValidationError
from app.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Workbook constants
# ---------------------------------------------------------------------------

SHEET_CLASSES = "Classes"
SHEET_ROOMS = "Rooms"
SHEET_SUBJECTS = "Subjects"
SHEET_FACULTY = "Faculty"
REQUIRED_SHEETS = (SHEET_CLASSES, SHEET_ROOMS, SHEET_SUBJECTS, SHEET_FACULTY)

# Canonical key -> human readable column name (used for error messages).
REQUIRED_CLASS_COLUMNS = {"class_name": "Class Name", "short_code": "Short Code", "section": "Section"}
REQUIRED_ROOM_COLUMNS = {"room_no": "Room No", "class_short_code": "Class Short Code", "section": "Section"}
REQUIRED_SUBJECT_COLUMNS = {
    "subject_code": "Subject Code",
    "subject_name": "Subject Name",
    "branch_classes": "Branch/Class",
}
REQUIRED_FACULTY_COLUMNS = {
    "faculty_name": "Faculty Name",
    "subject_code": "Subject Code",
    "subject_name": "Subject Name",
    "branch_classes": "Classes/Branch",
}

ColumnSpec = Tuple[str, Set[str], Callable[[str], bool]]

CLASS_COLUMN_SPECS: List[ColumnSpec] = [
    ("class_name", {"classname", "classbranchname", "class", "branchname", "branch"}, lambda k: "class" in k),
    ("short_code", {"shortcode", "short", "code", "classcode"}, lambda k: "short" in k or "code" in k),
    ("section", {"section", "sec", "classsection"}, lambda k: "section" in k),
]

ROOM_COLUMN_SPECS: List[ColumnSpec] = [
    ("room_no", {"roomno", "room", "roomnumber", "roomnum", "roomcode", "no", "number"}, lambda k: "room" in k),
    ("class_short_code", {"classshortcode", "shortcode", "short", "code", "classcode"}, lambda k: "shortcode" in k or "classcode" in k),
    ("section", {"section", "sec", "roomsection"}, lambda k: "section" in k),
]

SUBJECT_COLUMN_SPECS: List[ColumnSpec] = [
    ("subject_code", {"subjectcode", "subject", "code", "subjectid", "subjectno"}, lambda k: k.startswith("subjectcode")),
    ("subject_name", {"subjectname", "name", "subjecttitle", "title", "subject"}, lambda k: k.startswith("subjectname")),
    ("branch_classes", {"branchclass", "branchclasses", "branch", "class", "classes", "classcodes", "branches"}, lambda k: k.startswith("branch") or "class" in k),
]

FACULTY_COLUMN_SPECS: List[ColumnSpec] = [
    ("faculty_name", {"facultyname", "name", "faculty", "teacher", "staff"}, lambda k: k.startswith("faculty")),
    ("subject_code", {"subjectcode", "code", "subjectid", "subjectno"}, lambda k: k.startswith("subjectcode")),
    ("subject_name", {"subjectname", "name", "subject", "subjecttitle", "title"}, lambda k: k.startswith("subject")),
    ("branch_classes", {"classesbranch", "classes", "branch", "class", "classcodes", "branchclass", "branches"}, lambda k: k.startswith("branch") or k.startswith("class") or "class" in k),
]


# ---------------------------------------------------------------------------
# Low-level parsing helpers
# ---------------------------------------------------------------------------

def _normalize_header(value: Any) -> str:
    """
    Normalize a header label so column aliases can be matched reliably.

    "Class / Branch Name" -> "classbranchname"
    """
    return re.sub(r"[^a-z]+", "", str(value).strip().lower())


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


def _map_columns(columns: List[str], specs: List[ColumnSpec]) -> Dict[str, str]:
    """
    Map the raw Excel columns to the canonical record keys.

    Specs are ordered; the first spec whose aliases/predicate match a yet
    unmapped canonical key claims the column (mirrors the if/elif chain used
    by the per-module upload endpoints).

    Returns:
        Dict[str, str]: {canonical_key: actual_column_name}
    """
    mapping: Dict[str, str] = {}
    for col in columns:
        key = _normalize_header(col)
        for canonical, alias_set, predicate in specs:
            if canonical in mapping:
                continue
            if key in alias_set or predicate(key):
                mapping[canonical] = col
                break
    return mapping


def _problem(sheet: str, row: Optional[int], problem: str) -> Dict[str, Any]:
    """Build a structured validation error entry."""
    return {"sheet": sheet, "row": row, "problem": problem}


def _read_workbook(contents: bytes) -> Dict[str, pd.DataFrame]:
    """
    Parse the uploaded bytes into a {sheet_name: DataFrame} mapping.

    Raises:
        ExcelValidationError: When the file is corrupted or unreadable.
    """
    try:
        workbook = pd.read_excel(BytesIO(contents), sheet_name=None, dtype=object)
    except Exception as exc:  # corrupt file / unsupported engine
        logger.error("Failed to parse bulk Excel workbook: %s", exc)
        raise ExcelValidationError(
            "Could not read the Excel file.",
            [_problem(None, None, "The file appears to be corrupted or not a valid Excel workbook.")],
        )

    if not workbook:
        raise ExcelValidationError(
            "Empty workbook.",
            [_problem(None, None, "The workbook does not contain any sheets.")],
        )
    return workbook


# ---------------------------------------------------------------------------
# Per-sheet row parsing (structural validation only)
# ---------------------------------------------------------------------------

def _parse_classes(df: pd.DataFrame, problems: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    df.columns = [str(c).strip() for c in df.columns]
    mapping = _map_columns(list(df.columns), CLASS_COLUMN_SPECS)

    missing = [c for c in REQUIRED_CLASS_COLUMNS if c not in mapping]
    if missing:
        for c in missing:
            problems.append(
                _problem(
                    SHEET_CLASSES,
                    None,
                    f'The "{SHEET_CLASSES}" sheet is missing the "{REQUIRED_CLASS_COLUMNS[c]}" column.',
                )
            )
        return []

    rows: List[Dict[str, Any]] = []
    for index, row in df.iterrows():
        class_name = _clean(row[mapping["class_name"]])
        short_code = _clean(row[mapping["short_code"]]).upper()
        section = _clean(row[mapping["section"]]).upper()

        if not class_name and not short_code and not section:
            continue

        row_no = index + 2
        if not class_name:
            problems.append(_problem(SHEET_CLASSES, row_no, "Class Name is empty."))
        if not short_code:
            problems.append(_problem(SHEET_CLASSES, row_no, "Short Code is empty."))
        if not section:
            problems.append(_problem(SHEET_CLASSES, row_no, "Section is empty."))

        rows.append(
            {
                "row_no": row_no,
                "class_name": " ".join(class_name.split()),
                "short_code": short_code,
                "section": section,
            }
        )
    return rows


def _parse_rooms(df: pd.DataFrame, problems: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    df.columns = [str(c).strip() for c in df.columns]
    mapping = _map_columns(list(df.columns), ROOM_COLUMN_SPECS)

    missing = [c for c in REQUIRED_ROOM_COLUMNS if c not in mapping]
    if missing:
        for c in missing:
            problems.append(
                _problem(
                    SHEET_ROOMS,
                    None,
                    f'The "{SHEET_ROOMS}" sheet is missing the "{REQUIRED_ROOM_COLUMNS[c]}" column.',
                )
            )
        return []

    rows: List[Dict[str, Any]] = []
    for index, row in df.iterrows():
        room_no = _clean(row[mapping["room_no"]]).upper()
        class_short_code = _clean(row[mapping["class_short_code"]]).upper()
        section = _clean(row[mapping["section"]]).upper()

        if not room_no and not class_short_code and not section:
            continue

        row_no = index + 2
        if not room_no:
            problems.append(_problem(SHEET_ROOMS, row_no, "Room No is required."))
        if not class_short_code:
            problems.append(_problem(SHEET_ROOMS, row_no, "Class Short Code is empty."))
        if not section:
            problems.append(_problem(SHEET_ROOMS, row_no, "Section is empty."))

        rows.append(
            {
                "row_no": row_no,
                "room_no": room_no,
                "class_short_code": class_short_code,
                "section": section,
            }
        )
    return rows


def _parse_subjects(df: pd.DataFrame, problems: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    df.columns = [str(c).strip() for c in df.columns]
    mapping = _map_columns(list(df.columns), SUBJECT_COLUMN_SPECS)

    missing = [c for c in REQUIRED_SUBJECT_COLUMNS if c not in mapping]
    if missing:
        for c in missing:
            problems.append(
                _problem(
                    SHEET_SUBJECTS,
                    None,
                    f'The "{SHEET_SUBJECTS}" sheet is missing the "{REQUIRED_SUBJECT_COLUMNS[c]}" column.',
                )
            )
        return []

    rows: List[Dict[str, Any]] = []
    for index, row in df.iterrows():
        subject_code = _clean(row[mapping["subject_code"]]).upper()
        subject_name = _clean(row[mapping["subject_name"]])
        branch_classes = _parse_branches(_clean(row[mapping["branch_classes"]]))

        if not subject_code and not subject_name and not branch_classes:
            continue

        row_no = index + 2
        if not subject_code:
            problems.append(_problem(SHEET_SUBJECTS, row_no, "Subject Code is required."))
        if not subject_name:
            problems.append(_problem(SHEET_SUBJECTS, row_no, "Subject Name is required."))
        if not branch_classes:
            problems.append(_problem(SHEET_SUBJECTS, row_no, "At least one branch/class code is required."))

        rows.append(
            {
                "row_no": row_no,
                "subject_code": subject_code,
                "subject_name": subject_name,
                "branch_classes": branch_classes,
            }
        )
    return rows


def _parse_faculty(df: pd.DataFrame, problems: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    df.columns = [str(c).strip() for c in df.columns]
    mapping = _map_columns(list(df.columns), FACULTY_COLUMN_SPECS)

    missing = [c for c in REQUIRED_FACULTY_COLUMNS if c not in mapping]
    if missing:
        for c in missing:
            problems.append(
                _problem(
                    SHEET_FACULTY,
                    None,
                    f'The "{SHEET_FACULTY}" sheet is missing the "{REQUIRED_FACULTY_COLUMNS[c]}" column.',
                )
            )
        return []

    rows: List[Dict[str, Any]] = []
    for index, row in df.iterrows():
        faculty_name = _clean(row[mapping["faculty_name"]])
        subject_code = _clean(row[mapping["subject_code"]]).upper()
        subject_name = _clean(row[mapping["subject_name"]])
        branch_classes = _parse_branches(_clean(row[mapping["branch_classes"]]))

        if not faculty_name and not subject_code and not subject_name and not branch_classes:
            continue

        row_no = index + 2
        if not faculty_name:
            problems.append(_problem(SHEET_FACULTY, row_no, "Faculty Name is required."))
        elif len(faculty_name) < 3:
            problems.append(_problem(SHEET_FACULTY, row_no, "Faculty Name must be at least 3 characters."))
        if not subject_code:
            problems.append(_problem(SHEET_FACULTY, row_no, "Subject Code is empty."))
        if not subject_name:
            problems.append(_problem(SHEET_FACULTY, row_no, "Subject Name is empty."))
        if not branch_classes:
            problems.append(_problem(SHEET_FACULTY, row_no, "At least one class/branch is required."))

        rows.append(
            {
                "row_no": row_no,
                "faculty_name": faculty_name,
                "subject_code": subject_code,
                "subject_name": subject_name,
                "branch_classes": branch_classes,
            }
        )
    return rows


# ---------------------------------------------------------------------------
# Database reference data + cross-sheet relationship validation
# ---------------------------------------------------------------------------

async def _load_reference_data(db: AsyncSession) -> Dict[str, Any]:
    """Load the existing unique keys / reference objects needed for validation."""
    classes_result = await db.execute(select(Class))
    classes = classes_result.scalars().all()

    rooms_result = await db.execute(select(Room.room_no, Room.class_id))
    room_rows = rooms_result.all()
    room_codes = {r[0].strip().upper() for r in room_rows}
    claimed_class_ids = {r[1] for r in room_rows if r[1] is not None}

    subjects_result = await db.execute(select(Subject))
    subjects = subjects_result.scalars().all()

    faculty_result = await db.execute(
        select(Faculty, Subject.subject_code).join(
            Subject, Subject.id == Faculty.subject_id, isouter=True
        )
    )
    faculty_keys = {
        (fac.faculty_name.strip().lower(), (code or "").strip().upper())
        for fac, code in faculty_result.all()
    }

    class_by_key: Dict[Tuple[str, str], Class] = {}
    class_names: Set[Tuple[str, str]] = set()
    class_codes: Set[Tuple[str, str]] = set()
    for cls in classes:
        class_by_key[(cls.short_code.strip().upper(), cls.section.strip().upper())] = cls
        class_names.add((cls.class_name.strip().lower(), cls.section.strip().upper()))
        class_codes.add((cls.short_code.strip().lower(), cls.section.strip().upper()))

    subject_by_code: Dict[str, Subject] = {}
    subject_by_name: Dict[str, Subject] = {}
    for subject in subjects:
        code = (subject.subject_code or "").strip().upper()
        if code:
            subject_by_code[code] = subject
        name = (subject.subject_name or "").strip().lower()
        subject_by_name[name] = subject

    return {
        "classes": classes,
        "class_by_key": class_by_key,
        "class_names": class_names,
        "class_codes": class_codes,
        "class_short_codes": {code for code, _ in class_by_key},
        "room_codes": room_codes,
        "claimed_class_ids": claimed_class_ids,
        "subjects": subjects,
        "subject_by_code": subject_by_code,
        "subject_by_name": subject_by_name,
        "subject_codes_lower": {code.lower() for code in subject_by_code},
        "faculty_keys": faculty_keys,
    }


def _validate_relationships(
    parsed: Dict[str, List[Dict[str, Any]]],
    ref: Dict[str, Any],
    problems: List[Dict[str, Any]],
) -> None:
    """Validate cross-sheet references against the file itself plus the DB."""
    sheet_class_keys = {
        (row["short_code"], row["section"]) for row in parsed["classes"]
    }
    sheet_subject_codes = {row["subject_code"] for row in parsed["subjects"]}

    class_key_universe = sheet_class_keys | set(ref["class_by_key"])
    branch_code_universe = {code for code, _ in sheet_class_keys} | set(ref["class_short_codes"])
    subject_code_universe = sheet_subject_codes | set(ref["subject_by_code"])

    for room in parsed["rooms"]:
        key = (room["class_short_code"], room["section"])
        if key not in class_key_universe:
            problems.append(
                _problem(
                    SHEET_ROOMS,
                    room["row_no"],
                    f'Class "{room["class_short_code"]}" with Section "{room["section"]}" '
                    f'was not found in the Classes sheet.',
                )
            )

    for subject in parsed["subjects"]:
        for code in subject["branch_classes"]:
            if code not in branch_code_universe:
                problems.append(
                    _problem(
                        SHEET_SUBJECTS,
                        subject["row_no"],
                        f'Class "{code}" was not found in the Classes sheet.',
                    )
                )

    for faculty in parsed["faculty"]:
        code = faculty["subject_code"]
        name_key = faculty["subject_name"].strip().lower()
        if code not in subject_code_universe and name_key not in ref["subject_by_name"]:
            problems.append(
                _problem(
                    SHEET_FACULTY,
                    faculty["row_no"],
                    f'Subject "{faculty["subject_name"]}" was not found.',
                )
            )
            continue

        for branch in faculty["branch_classes"]:
            short_code, section = split_branch_token(branch)
            if short_code not in branch_code_universe:
                problems.append(
                    _problem(
                        SHEET_FACULTY,
                        faculty["row_no"],
                        f'Class "{short_code}" was not found in the Classes sheet.',
                    )
                )
            elif section is not None and (short_code, section) not in class_key_universe:
                problems.append(
                    _problem(
                        SHEET_FACULTY,
                        faculty["row_no"],
                        f'Class "{short_code}" with Section "{section}" '
                        f'was not found in the Classes sheet.',
                    )
                )


# ---------------------------------------------------------------------------
# Import (single transaction)
# ---------------------------------------------------------------------------

async def _perform_import(
    db: AsyncSession,
    user: Dict[str, Any],
    parsed: Dict[str, List[Dict[str, Any]]],
    ref: Dict[str, Any],
) -> Dict[str, Dict[str, int]]:
    """Insert validated rows. Returns per-sheet {total, imported, skipped}."""
    user_id = uuid.UUID(str(user["id"])) if user.get("id") else None
    counts = {
        "classes": {"total": len(parsed["classes"]), "imported": 0, "skipped": 0},
        "rooms": {"total": len(parsed["rooms"]), "imported": 0, "skipped": 0},
        "subjects": {"total": len(parsed["subjects"]), "imported": 0, "skipped": 0},
        "faculty": {"total": len(parsed["faculty"]), "imported": 0, "skipped": 0},
    }

    # --- Classes -----------------------------------------------------------
    seen_names = set(ref["class_names"])
    seen_codes = set(ref["class_codes"])
    new_class_by_key: Dict[Tuple[str, str], Class] = {}

    for row in parsed["classes"]:
        name_key = (row["class_name"].lower(), row["section"])
        code_key = (row["short_code"].lower(), row["section"])
        if name_key in seen_names or code_key in seen_codes:
            counts["classes"]["skipped"] += 1
            continue
        seen_names.add(name_key)
        seen_codes.add(code_key)
        cls = Class(
            class_name=row["class_name"],
            short_code=row["short_code"],
            section=row["section"],
            created_by=user_id,
        )
        db.add(cls)
        new_class_by_key[(row["short_code"], row["section"])] = cls
        counts["classes"]["imported"] += 1

    await db.flush()

    class_by_key = dict(ref["class_by_key"])
    class_by_key.update(new_class_by_key)

    # --- Rooms -------------------------------------------------------------
    seen_rooms = set(ref["room_codes"])
    claimed_class_ids = set(ref["claimed_class_ids"])

    for row in parsed["rooms"]:
        if row["room_no"] in seen_rooms:
            counts["rooms"]["skipped"] += 1
            continue
        seen_rooms.add(row["room_no"])
        cls = class_by_key.get((row["class_short_code"], row["section"]))
        class_id = cls.id if (cls is not None and cls.id not in claimed_class_ids) else None
        if class_id is not None:
            claimed_class_ids.add(class_id)
        db.add(
            Room(
                room_no=row["room_no"],
                class_short_code=row["class_short_code"],
                section=row["section"],
                class_id=class_id,
                created_by=user_id,
            )
        )
        counts["rooms"]["imported"] += 1

    await db.flush()

    # --- Subjects ----------------------------------------------------------
    seen_subject_codes = set(ref["subject_codes_lower"])
    new_subject_by_code: Dict[str, Subject] = {}

    for row in parsed["subjects"]:
        if row["subject_code"].lower() in seen_subject_codes:
            counts["subjects"]["skipped"] += 1
            continue
        seen_subject_codes.add(row["subject_code"].lower())
        subject = Subject(
            subject_code=row["subject_code"],
            subject_name=row["subject_name"],
            branch_classes=row["branch_classes"],
            created_by=user_id,
        )
        db.add(subject)
        new_subject_by_code[row["subject_code"]] = subject
        counts["subjects"]["imported"] += 1

    await db.flush()

    # --- Faculty -----------------------------------------------------------
    seen_faculty = set(ref["faculty_keys"])
    subject_by_code = dict(ref["subject_by_code"])
    subject_by_code.update(new_subject_by_code)

    for row in parsed["faculty"]:
        code = row["subject_code"]
        subject = subject_by_code.get(code) or ref["subject_by_name"].get(
            row["subject_name"].strip().lower()
        )
        if subject is None:
            # Relationship validation already rejected this row; skip defensively.
            counts["faculty"]["skipped"] += 1
            continue
        key = (row["faculty_name"].strip().lower(), code)
        if key in seen_faculty:
            counts["faculty"]["skipped"] += 1
            continue
        seen_faculty.add(key)
        db.add(
            Faculty(
                faculty_name=row["faculty_name"],
                subject_id=subject.id,
                branch_classes=row["branch_classes"],
                created_by=user_id,
            )
        )
        counts["faculty"]["imported"] += 1

    await db.flush()
    return counts


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def process_bulk_upload(
    db: AsyncSession, user: Dict[str, Any], contents: bytes
) -> Dict[str, Dict[str, int]]:
    """
    Validate a 4-sheet workbook and import it inside a single transaction.

    Validation (sheets -> columns -> cell values -> cross-sheet references)
    happens before any row is inserted, so a failed file imports nothing.

    Raises:
        ExcelValidationError: With structured per-sheet/per-row problems.

    Returns:
        Dict[str, Dict[str, int]]: Per-sheet {total, imported, skipped} counts.
    """
    workbook = _read_workbook(contents)

    missing_sheets = [name for name in REQUIRED_SHEETS if name not in workbook]
    if missing_sheets:
        problems = [
            _problem(
                None,
                None,
                f'The workbook must contain a sheet named "{name}".',
            )
            for name in missing_sheets
        ]
        raise ExcelValidationError(
            "Upload failed. The Excel file must contain Classes, Rooms, Subjects, and Faculty sheets.",
            problems,
        )

    problems: List[Dict[str, Any]] = []
    parsed: Dict[str, List[Dict[str, Any]]] = {
        "classes": _parse_classes(workbook[SHEET_CLASSES], problems),
        "rooms": _parse_rooms(workbook[SHEET_ROOMS], problems),
        "subjects": _parse_subjects(workbook[SHEET_SUBJECTS], problems),
        "faculty": _parse_faculty(workbook[SHEET_FACULTY], problems),
    }

    if problems:
        raise ExcelValidationError(
            f"Upload failed. The workbook contains {len(problems)} problem(s). Fix the rows below and try again.",
            problems,
        )

    ref = await _load_reference_data(db)
    _validate_relationships(parsed, ref, problems)

    if problems:
        raise ExcelValidationError(
            f"Upload failed. The workbook contains {len(problems)} problem(s). Fix the rows below and try again.",
            problems,
        )

    counts = await _perform_import(db, user, parsed, ref)
    logger.info(
        "Bulk import completed: %s",
        {sheet: counts[sheet] for sheet in counts},
    )
    return counts


# ---------------------------------------------------------------------------
# Sample template
# ---------------------------------------------------------------------------

def generate_template_workbook() -> bytes:
    """
    Build a sample workbook with the four required sheets and sample rows.

    Returns:
        bytes: The workbook serialized to an in-memory byte stream.
    """
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")

    def _style_header(ws) -> None:
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="left")
        ws.freeze_panes = "A2"

    wb = Workbook()

    classes = wb.active
    classes.title = SHEET_CLASSES
    classes.append(["Class Name", "Short Code", "Section"])
    classes.append(["Computer Science Engineering", "CSE", "A"])
    classes.append(["Computer Science Engineering", "CSE", "B"])
    classes.append(["Electronics & Communication Engineering", "ECE", "A"])
    _style_header(classes)

    rooms = wb.create_sheet(SHEET_ROOMS)
    rooms.append(["Room No", "Class Short Code", "Section"])
    rooms.append(["LAB-CSE-1", "CSE", "A"])
    rooms.append(["A-101", "CSE", "B"])
    rooms.append(["B-204", "ECE", "A"])
    _style_header(rooms)

    subjects = wb.create_sheet(SHEET_SUBJECTS)
    subjects.append(["Subject Code", "Subject Name", "Branch/Class"])
    subjects.append(["CS101", "Data Structures", "CSE, ECE"])
    subjects.append(["CS102", "Operating Systems", "CSE"])
    subjects.append(["EC201", "Digital Electronics", "ECE"])
    _style_header(subjects)

    faculty = wb.create_sheet(SHEET_FACULTY)
    faculty.append(["Faculty Name", "Subject Code", "Subject Name", "Classes/Branch"])
    faculty.append(["Dr. John Smith", "CS101", "Data Structures", "CSE-A, CSE-B"])
    faculty.append(["Dr. Jane Doe", "CS102", "Operating Systems", "CSE-B"])
    faculty.append(["Dr. Alan Turing", "EC201", "Digital Electronics", "ECE-A"])
    _style_header(faculty)

    for ws in (classes, rooms, subjects, faculty):
        for column_cells in ws.columns:
            width = max(len(str(cell.value or "")) + 4 for cell in column_cells)
            ws.column_dimensions[column_cells[0].column_letter].width = max(width, 12)

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
