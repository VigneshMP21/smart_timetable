"""
Purpose: Timetable Scheduler Orchestration Service
Author: Smart Timetable Backend Team
Module Description: Loads classes/rooms/subjects/faculty and the user's Setup
configuration from the DB, validates the generation gate (room shortage is a
hard error), runs the AutoScheduler, persists the entries and formats the
structured response consumed by the frontend.
"""

from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.models.timetable_model import TimetableEntry
from app.services.setup_config import (
    load_config,
    validate_config_for_generation,
)
from app.services.timetable_data import TimetableDataService
from app.algorithms.auto_scheduler import AutoScheduler

from app.utils.logger import get_logger

logger = get_logger(__name__)


class SchedulerService:
    """
    Main orchestration class that reads inputs from DB, triggers the scheduler,
    stores schedules and formats the response.
    """

    @classmethod
    async def generate_timetable(
        cls,
        db: AsyncSession,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a conflict-free timetable for all classes.

        Args:
            db (AsyncSession): Active database session.
            user_id (Optional[str]): Supabase user id used to scope the Setup
                configuration lookup.

        Returns:
            Dict: The structured JSON timetable output.

        Raises:
            SchedulingFailureError: For missing inputs, room shortage, invalid
                Setup, incomplete assignments or an infeasible schedule.
        """
        logger.info("Fetching classes, rooms, subjects, faculty and Setup config.")

        domain = await TimetableDataService.load_domain(db)
        TimetableDataService.validate_generation_gate(domain)

        config = await load_config(db, user_id)
        validate_config_for_generation(config)

        class_models = TimetableDataService.build_class_models(domain)

        logger.info("Running auto scheduler over %d classes.", len(class_models))
        grid = AutoScheduler.schedule(class_models, config)

        # 4. Persist results (replace previous timetable)
        creator_uuid = None
        if user_id is not None:
            try:
                import uuid
                from app.models.profile_model import Profile
                from sqlalchemy import select
                uid = uuid.UUID(str(user_id))
                prof_res = await db.execute(select(Profile.id).where(Profile.id == uid))
                if prof_res.scalar_one_or_none() is not None:
                    creator_uuid = uid
                else:
                    # Attempt to create profile row if missing
                    try:
                        new_prof = Profile(id=uid, full_name="", role="user")
                        db.add(new_prof)
                        await db.commit()
                        creator_uuid = uid
                    except Exception:
                        await db.rollback()
                        creator_uuid = None
            except Exception as e:
                logger.warning(f"Could not verify profile for user {user_id}: {e}")
                creator_uuid = None

        if creator_uuid is not None:
            await db.execute(
                delete(TimetableEntry).where(
                    (TimetableEntry.created_by == creator_uuid) | (TimetableEntry.created_by.is_(None))
                )
            )
        else:
            await db.execute(delete(TimetableEntry))

        entries_count = 0
        for cm in class_models:
            class_id = cm["class_id"]
            class_grid = grid[class_id]
            for day, periods in class_grid.items():
                for period, slot in periods.items():
                    entry = TimetableEntry(
                        class_id=class_id,
                        subject_id=slot["subject_id"] if slot else None,
                        faculty_id=slot["faculty_id"] if slot else None,
                        room_no=slot["room_no"] if slot else cm.get("room_no"),
                        day=day,
                        period=period,
                        start_time=None,
                        end_time=None,
                        is_break=False,
                        is_lunch=False,
                        created_by=creator_uuid,
                    )
                    db.add(entry)
                    entries_count += 1

        await db.commit()
        logger.info("Successfully saved %d timetable entries to database.", entries_count)

        timetable = TimetableDataService.format_timetable(class_models, config, grid)

        return {
            "status": "success",
            "message": "Timetable generated successfully.",
            "entries_count": entries_count,
            "classes": [TimetableDataService.class_info(cm) for cm in class_models],
            "config": config,
            "timetable": timetable,
        }

    @classmethod
    async def load_timetable(
        cls,
        db: AsyncSession,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Build the timetable response from the currently saved entries (no
        re-generation). Used by GET /timetable so saved manual edits are
        reflected after reload.
        """
        domain = await TimetableDataService.load_domain(db)
        config = await load_config(db, user_id)
        class_models = TimetableDataService.build_class_models(domain)

        entries = await TimetableDataService.load_saved_entries(db, user_id)
        grid = TimetableDataService.grid_from_entries(entries)

        timetable = TimetableDataService.format_timetable(class_models, config, grid)

        return {
            "status": "success",
            "message": "Timetable loaded successfully.",
            "entries_count": len(entries),
            "classes": [TimetableDataService.class_info(cm) for cm in class_models],
            "config": config,
            "timetable": timetable,
        }

    @classmethod
    async def reset_timetable(
        cls,
        db: AsyncSession,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Delete saved timetable entries.

        Args:
            user_id (Optional[str]): When provided, only the entries owned by
                this user are deleted; otherwise all entries are deleted.
        """
        if user_id is not None:
            await db.execute(
                delete(TimetableEntry).where(TimetableEntry.created_by == user_id)
            )
        else:
            await db.execute(delete(TimetableEntry))
        await db.commit()
        return {
            "status": "success",
            "message": "Timetable reset successfully.",
            "entries_count": 0,
            "timetable": {},
        }
