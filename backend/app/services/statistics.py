"""
Purpose: Timetable Statistics Service
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Gathers scheduling workload data, faculty teaching hours,
and utility metrics from the database using the real class/room/subject/
faculty schema.
"""

from typing import Dict, Any, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.timetable_model import TimetableEntry
from app.models.faculty_model import Faculty
from app.models.class_model import Class
from app.models.subject_model import Subject
from app.services.setup_config import load_config, instructional_period_numbers
from app.utils.logger import get_logger

logger = get_logger(__name__)


class StatisticsService:
    """
    Computes analytical metrics for classes, teaching hours, and faculty distributions.
    """

    @classmethod
    async def get_faculty_statistics(
        cls,
        db: AsyncSession,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retrieves consolidated scheduling statistics.

        Args:
            db (AsyncSession): Active database session.
            user_id (Optional[str]): Scopes the Setup config used for totals.

        Returns:
            Dict: Comprehensive statistical payload.
        """
        logger.info("Generating faculty and schedule statistics.")

        faculties = (await db.execute(select(Faculty))).scalars().all()
        classes = (await db.execute(select(Class))).scalars().all()
        subjects = (await db.execute(select(Subject))).scalars().all()

        entries_query = select(TimetableEntry).options(
            selectinload(TimetableEntry.academic_class),
            selectinload(TimetableEntry.faculty),
        )
        if user_id is not None:
            entries_query = entries_query.where(TimetableEntry.created_by == user_id)
        entries = (await db.execute(entries_query)).scalars().all()

        config = await load_config(db, user_id)
        working_days = len(config.get("working_days") or [])
        periods_per_day = len(instructional_period_numbers(config))
        total_possible_slots_per_class = working_days * periods_per_day
        total_institution_slots = total_possible_slots_per_class * len(classes)

        teaching_entries = [e for e in entries if e.faculty_id is not None]

        faculty_stats = {}
        for f in faculties:
            faculty_stats[f.faculty_name] = {
                "department": "-",
                "subject": None,
                "total_hours": 0,
                "classes_taught": set(),
                "daily_load": {},
            }

        for entry in teaching_entries:
            fac_name = entry.faculty.faculty_name if entry.faculty else None
            if not fac_name or fac_name not in faculty_stats:
                continue
            class_name = entry.academic_class.class_name
            section = entry.academic_class.section
            label = f"{class_name} - {section}"
            day = entry.day

            faculty_stats[fac_name]["total_hours"] += 1
            faculty_stats[fac_name]["classes_taught"].add(label)
            faculty_stats[fac_name]["daily_load"][day] = (
                faculty_stats[fac_name]["daily_load"].get(day, 0) + 1
            )

        subject_by_id = {str(s.id): s.subject_name for s in subjects}
        for f in faculties:
            if f.faculty_name in faculty_stats:
                faculty_stats[f.faculty_name]["subject"] = subject_by_id.get(str(f.subject_id))

        formatted_faculty_stats = []
        for name, stats in faculty_stats.items():
            formatted_faculty_stats.append(
                {
                    "faculty_name": name,
                    "department": stats["department"],
                    "subject": stats["subject"],
                    "total_hours": stats["total_hours"],
                    "classes_taught": sorted(list(stats["classes_taught"])),
                    "daily_load": stats["daily_load"],
                }
            )

        formatted_faculty_stats.sort(key=lambda x: x["faculty_name"])

        utilization_rate = 0.0
        if total_institution_slots > 0:
            utilization_rate = round((len(teaching_entries) / total_institution_slots) * 100, 2)

        return {
            "summary": {
                "total_classes": len(classes),
                "total_subjects": len(subjects),
                "total_faculty": len(faculties),
                "total_scheduled_periods": len(teaching_entries),
                "overall_utilization_percentage": utilization_rate,
            },
            "faculty_statistics": formatted_faculty_stats,
        }
