"""
Purpose: Shared Timetable Data Service
Author: Smart Timetable Backend Team
Module Description: Central place that loads domain data (classes, rooms,
subjects, faculties), prepares per-class scheduling models, formats grids
into the nested Class -> Day -> periods response shape and validates the
generation preconditions shared by the scheduler, exports and APIs.
"""

from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.class_model import Class
from app.models.faculty_model import Faculty
from app.models.room_model import Room
from app.models.subject_model import Subject
from app.models.timetable_model import TimetableEntry
from app.services.class_utils import faculty_branch_codes, faculty_matches_class
from app.services.setup_config import instructional_period_numbers
from app.utils.exceptions import SchedulingFailureError


def _subject_type(subject_name: str) -> str:
    """Infer the display type from the subject name (no type column exists)."""
    upper = (subject_name or "").upper()
    if "LAB" in upper or "PRACTICAL" in upper:
        return "Lab"
    return "Theory"


class TimetableDataService:
    """
    Loads and prepares all domain data needed by the scheduler and exports.
    """

    @classmethod
    async def load_domain(cls, db: AsyncSession) -> Dict[str, List[Any]]:
        """
        Fetch classes, rooms, subjects and faculty rows from the database.
        """
        classes_res = await db.execute(select(Class))
        classes = list(classes_res.scalars().all())

        rooms_res = await db.execute(select(Room))
        rooms = list(rooms_res.scalars().all())

        subjects_res = await db.execute(select(Subject))
        subjects = list(subjects_res.scalars().all())

        faculty_res = await db.execute(select(Faculty))
        faculties = list(faculty_res.scalars().all())

        return {
            "classes": classes,
            "rooms": rooms,
            "subjects": subjects,
            "faculties": faculties,
        }

    @classmethod
    def validate_generation_gate(cls, domain: Dict[str, List[Any]]) -> None:
        """
        Raise a clear, user-facing error when any required input is missing.
        The room-count check is a hard error: generation never proceeds with
        room conflicts.
        """
        classes = domain["classes"]
        rooms = domain["rooms"]
        subjects = domain["subjects"]
        faculties = domain["faculties"]

        if not classes:
            raise SchedulingFailureError(
                "No classes found. Please add classes before generating the timetable."
            )
        if not subjects:
            raise SchedulingFailureError(
                "No subjects found. Please add subjects before generating the timetable."
            )
        if not faculties:
            raise SchedulingFailureError(
                "No faculty found. Please add faculty before generating the timetable."
            )

        assigned_room_count = sum(1 for r in rooms if r.class_id is not None)
        if assigned_room_count < len(classes):
            raise SchedulingFailureError(
                f"Not enough rooms ({assigned_room_count} rooms for {len(classes)} classes). "
                "Please assign a room to every class before generating the timetable."
            )

    @classmethod
    def build_class_models(
        cls,
        domain: Dict[str, List[Any]],
    ) -> List[Dict[str, Any]]:
        """
        Prepare per-class scheduling models (label, room, applicable subjects
        and their faculty). Raises SchedulingFailureError listing every
        missing subject/faculty assignment so the user can fix them.
        """
        classes = domain["classes"]
        rooms = domain["rooms"]
        subjects = domain["subjects"]
        faculties = domain["faculties"]

        room_by_class = {r.class_id: r.room_no for r in rooms if r.class_id is not None}

        # Faculty rows grouped by (subject_id, short_code). Combined
        # "CODE-SECTION" tokens are reduced to their short code for grouping;
        # section eligibility is checked against the class below.
        faculty_by_subject = {}
        for f in faculties:
            for short_code in faculty_branch_codes(f):
                faculty_by_subject.setdefault((str(f.subject_id), short_code), []).append(f)

        class_models = []
        errors: List[str] = []

        for c in classes:
            applicable = [
                s for s in subjects if c.short_code in (s.branch_classes or [])
            ]
            applicable.sort(key=lambda s: s.subject_name)

            if not applicable:
                errors.append(
                    f"No subjects assigned for class '{c.class_name} - {c.section}'. "
                    "Please assign subjects to this branch."
                )

            subjects_ctx = []
            for s in applicable:
                faculty_matches = faculty_by_subject.get((str(s.id), c.short_code)) or []
                eligible = [
                    f for f in faculty_matches
                    if faculty_matches_class(f, c.short_code, c.section)
                ]
                if not eligible:
                    errors.append(
                        f"Subject '{s.subject_name}' has no faculty assigned for class "
                        f"'{c.class_name} - {c.section}'."
                    )
                    continue
                f = eligible[0]
                subjects_ctx.append(
                    {
                        "subject_id": s.id,
                        "subject_code": s.subject_code,
                        "subject_name": s.subject_name,
                        "faculty_id": f.id,
                        "faculty_name": f.faculty_name,
                    }
                )

            class_models.append(
                {
                    "class_id": c.id,
                    "class_name": c.class_name,
                    "short_code": c.short_code,
                    "section": c.section,
                    "label": f"{c.class_name} - {c.section}",
                    "room_no": room_by_class.get(c.id),
                    "subjects": subjects_ctx,
                }
            )

        if errors:
            raise SchedulingFailureError("; ".join(errors))

        return class_models

    @classmethod
    def class_info(cls, class_model: Dict[str, Any]) -> Dict[str, Any]:
        """Public metadata for a class used in API responses."""
        return {
            "class_id": class_model["class_id"],
            "class_name": class_model["class_name"],
            "short_code": class_model["short_code"],
            "section": class_model["section"],
            "room_no": class_model.get("room_no"),
        }

    @classmethod
    def format_timetable(
        cls,
        class_models: List[Dict[str, Any]],
        config: Dict[str, Any],
        grid: Dict[int, Dict[str, Dict[int, Optional[Dict[str, Any]]]]],
    ) -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
        """
        Convert an in-memory grid into the nested response shape:
        Class label -> Day -> list of slot dicts (every period/interval present,
        with break/lunch/free markers filled in).

        The periods array now contains interleaved teaching periods and
        break/lunch intervals. Each entry has is_teaching, is_break, is_lunch
        flags to distinguish types.
        """
        working_days = config["working_days"]
        periods = config["periods"]

        formatted = {}
        for cm in class_models:
            class_grid = grid.get(cm["class_id"], {})
            formatted[cm["label"]] = {}
            for day in working_days:
                day_grid = class_grid.get(day, {})
                formatted[cm["label"]][day] = []
                for period in periods:
                    p_num = period["period_number"]
                    is_break = period.get("is_break", False)
                    is_lunch = period.get("is_lunch", False)
                    is_teaching = period.get("is_teaching", True)

                    if is_break:
                        formatted[cm["label"]][day].append(
                            cls._format_break_slot(period, cm["room_no"])
                        )
                    elif is_lunch:
                        formatted[cm["label"]][day].append(
                            cls._format_lunch_slot(period, cm["room_no"])
                        )
                    else:
                        slot = day_grid.get(p_num)
                        formatted[cm["label"]][day].append(
                            cls.format_slot(
                                slot,
                                p_num,
                                periods,
                                cm["room_no"],
                            )
                        )
        return formatted

    @classmethod
    def _format_break_slot(
        cls,
        period: Dict[str, Any],
        default_room: Optional[str],
    ) -> Dict[str, Any]:
        """Format a break interval slot."""
        return {
            "period": f"break_{period['period_number']}",
            "start_time": period.get("start_time"),
            "end_time": period.get("end_time"),
            "subject": "Break",
            "subject_code": None,
            "faculty": "-",
            "room": default_room,
            "type": "Break",
            "subject_id": None,
            "faculty_id": None,
        }

    @classmethod
    def _format_lunch_slot(
        cls,
        period: Dict[str, Any],
        default_room: Optional[str],
    ) -> Dict[str, Any]:
        """Format a lunch interval slot."""
        return {
            "period": f"lunch_{period['period_number']}",
            "start_time": period.get("start_time"),
            "end_time": period.get("end_time"),
            "subject": "Lunch Break",
            "subject_code": None,
            "faculty": "-",
            "room": default_room,
            "type": "Lunch",
            "subject_id": None,
            "faculty_id": None,
        }

    @classmethod
    def format_slot(
        cls,
        slot: Optional[Dict[str, Any]],
        period_number: int,
        periods: List[Dict[str, Any]],
        default_room: Optional[str],
    ) -> Dict[str, Any]:
        """
        Format a single teaching grid slot into the response dict.
        Free slots are synthesized when the grid cell has no teaching entry.
        """
        # Find timing info for this teaching period
        time_info = {}
        for p in periods:
            if p.get("is_teaching", True) and p["period_number"] == period_number:
                time_info = p
                break

        base = {
            "period": period_number,
            "start_time": time_info.get("start_time"),
            "end_time": time_info.get("end_time"),
        }

        if not slot or not slot.get("subject_id"):
            return {
                **base,
                "subject": "Free Period",
                "subject_code": None,
                "faculty": "-",
                "room": default_room,
                "type": "Free",
                "subject_id": None,
                "faculty_id": None,
            }

        return {
            **base,
            "subject": slot["subject_name"],
            "subject_code": slot.get("subject_code"),
            "faculty": slot["faculty_name"],
            "room": slot.get("room_no") or default_room,
            "type": _subject_type(slot["subject_name"]),
            "subject_id": str(slot["subject_id"]) if slot.get("subject_id") else None,
            "faculty_id": str(slot["faculty_id"]) if slot.get("faculty_id") else None,
        }

    @classmethod
    async def load_saved_entries(
        cls,
        db: AsyncSession,
        user_id: Optional[str] = None,
    ) -> List[TimetableEntry]:
        """
        Fetch saved timetable entries with their relationships resolved.

        Args:
            user_id (Optional[str]): When provided, only the entries owned by
                this user are returned; otherwise all entries are returned.
        """
        query = select(TimetableEntry).options(
            selectinload(TimetableEntry.academic_class),
            selectinload(TimetableEntry.subject),
            selectinload(TimetableEntry.faculty),
        )
        if user_id is not None:
            from sqlalchemy import or_
            try:
                import uuid
                uid = uuid.UUID(str(user_id))
                query = query.where(or_(TimetableEntry.created_by == uid, TimetableEntry.created_by.is_(None)))
            except Exception:
                query = query.where(or_(TimetableEntry.created_by == user_id, TimetableEntry.created_by.is_(None)))
        result = await db.execute(query)
        return list(result.scalars().all())

    @classmethod
    def grid_from_entries(
        cls,
        entries: List[TimetableEntry],
    ) -> Dict[int, Dict[str, Dict[int, Optional[Dict[str, Any]]]]]:
        """
        Rebuild the in-memory grid from saved DB entries so the API and
        exports present exactly what is stored (including manual edits).
        """
        grid: Dict[int, Dict[str, Dict[int, Optional[Dict[str, Any]]]]] = {}
        for entry in entries:
            slot = {
                "subject_id": entry.subject_id,
                "subject_code": entry.subject.subject_code if entry.subject else None,
                "subject_name": entry.subject.subject_name if entry.subject else None,
                "faculty_id": entry.faculty_id,
                "faculty_name": entry.faculty.faculty_name if entry.faculty else "-",
                "room_no": entry.room_no,
                "is_break": entry.is_break,
                "is_lunch": entry.is_lunch,
            }
            grid.setdefault(entry.class_id, {}).setdefault(entry.day, {})[entry.period] = slot
        return grid
