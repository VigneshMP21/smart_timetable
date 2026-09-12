"""
Purpose: Manual Timetable Edit Service
Author: Smart Timetable Backend Team
Module Description: Validates a full-grid manual edit for one class against
the hard constraints (subject/faculty applicability, faculty and room
uniqueness per day+period, break/lunch immutability) and persists the edited
grid, replacing the class's previous entries.
"""

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.class_model import Class
from app.models.timetable_model import TimetableEntry
from app.models.faculty_model import Faculty
from app.models.subject_model import Subject
from app.services.class_utils import faculty_matches_class
from app.services.setup_config import load_config
from app.services.timetable_data import TimetableDataService
from app.utils.exceptions import TimetableEditValidationError


def _to_uuid(value: Optional[str]):
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


class TimetableEditService:
    """
    Validates and persists manual timetable edits.
    """

    @classmethod
    async def replace_class_timetable(
        cls,
        db: AsyncSession,
        class_id: int,
        entries: List[Dict[str, Any]],
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Validate a full-grid submission for one class and replace its stored
        entries. Returns the full timetable response (all classes) so the
        frontend can refresh its shared state.

        Raises:
            TimetableEditValidationError: With the exact conflict messages when
                any cell violates a hard constraint.
        """
        class_row = (await db.execute(select(Class).where(Class.id == class_id))).scalars().first()
        if class_row is None:
            raise TimetableEditValidationError("Class not found.", [])
        label = f"{class_row.class_name} - {class_row.section}"
        short_code = class_row.short_code

        domain = await TimetableDataService.load_domain(db)
        config = await load_config(db, user_id)
        # With the new model, breaks/lunch are intervals not periods.
        # The grid only contains teaching periods, so break/lunch validation
        # is handled by the scheduler (it never assigns subjects to breaks/lunch).
        period_time = {p["period_number"]: p for p in config.get("periods", []) if p.get("is_teaching", True)}

        # Class-specific lookups
        room_by_class = {r.class_id: r.room_no for r in domain["rooms"] if r.class_id is not None}
        class_room = room_by_class.get(class_id)

        applicable_subjects = [
            s for s in domain["subjects"] if short_code in (s.branch_classes or [])
        ]
        subject_by_id = {str(s.id): s for s in applicable_subjects}

        faculty_by_key = {}
        for f in domain["faculties"]:
            faculty_by_key[(str(f.subject_id), str(f.id))] = f

        # Other classes' currently saved allocations (scoped to this user's
        # timetable so edits only conflict-check against the user's own data)
        other_query = (
            select(TimetableEntry)
            .options(
                selectinload(TimetableEntry.faculty),
                selectinload(TimetableEntry.subject),
            )
            .where(TimetableEntry.class_id != class_id)
        )
        if user_id is not None:
            other_query = other_query.where(TimetableEntry.created_by == user_id)
        other_rows = (await db.execute(other_query)).scalars().all()

        other_faculty_occupied = {
            (str(e.faculty_id), e.day, e.period)
            for e in other_rows
            if e.faculty_id is not None
        }
        other_room_occupied = {
            (e.room_no, e.day, e.period)
            for e in other_rows
            if e.room_no
        }

        errors: List[str] = []
        seen_faculty = set()
        seen_room = set()

        for cell in entries:
            day = cell.get("day")
            period = cell.get("period")
            subject_id = _to_uuid(cell.get("subject_id"))
            faculty_id = _to_uuid(cell.get("faculty_id"))
            room_no = cell.get("room_no") or class_room

            if subject_id is None:
                # Free period
                continue

            subject = subject_by_id.get(str(subject_id))
            if subject is None:
                errors.append(
                    f"Subject is not assigned to class '{label}'. "
                    "Select a subject from the class's assigned list."
                )
                continue

            if faculty_id is None:
                errors.append(f"Faculty is required for subject '{subject.subject_name}'.")
                continue

            faculty = faculty_by_key.get((str(subject_id), str(faculty_id)))
            if faculty is None or not faculty_matches_class(faculty, short_code, class_row.section):
                errors.append(
                    f"Faculty does not teach '{subject.subject_name}' for class '{label}'."
                )
                continue

            faculty_key = (str(faculty_id), day, period)
            if faculty_key in seen_faculty or faculty_key in other_faculty_occupied:
                errors.append(
                    f"Faculty conflict: {faculty.faculty_name} is already assigned during this period."
                )
            seen_faculty.add(faculty_key)

            room_key = (room_no, day, period)
            if room_no and (room_key in seen_room or room_key in other_room_occupied):
                errors.append(
                    f"Room conflict: {room_no} is already assigned during this period."
                )
            if room_no:
                seen_room.add(room_key)

        if errors:
            raise TimetableEditValidationError(
                "Timetable has conflicts. Please resolve them before saving.",
                errors,
            )

        # Persist the validated grid
        await db.execute(
            delete(TimetableEntry).where(TimetableEntry.class_id == class_id)
        )

        for cell in entries:
            day = cell.get("day")
            period = cell.get("period")
            subject_id = _to_uuid(cell.get("subject_id"))
            faculty_id = _to_uuid(cell.get("faculty_id"))
            room_no = cell.get("room_no") or class_room
            time = period_time.get(period, {})

            entry = TimetableEntry(
                class_id=class_id,
                subject_id=subject_id,
                faculty_id=faculty_id,
                room_no=room_no,
                day=day,
                period=period,
                start_time=time.get("start_time"),
                end_time=time.get("end_time"),
                is_break=False,
                is_lunch=False,
                created_by=user_id,
            )
            db.add(entry)

        await db.commit()

        from app.services.scheduler import SchedulerService
        return await SchedulerService.load_timetable(db, user_id)
