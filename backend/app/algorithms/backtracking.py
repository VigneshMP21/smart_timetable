"""
Purpose: Backtracking Repair Scheduler
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Implements backtracking-based search to resolve unallocated hours and scheduling conflicts.
"""

from typing import Dict, Any, List
import random
from app.utils.logger import get_logger
from app.services.conflict_checker import ConflictChecker

logger = get_logger(__name__)


class BacktrackingSolver:
    """
    Recursively attempts to place unallocated hours by shifting or swapping conflicting slots.
    """

    @classmethod
    def solve(
        cls,
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        faculty_schedule: Dict[str, Dict[str, Dict[int, str]]],
        unallocated_subjects: List[Dict[str, Any]],
        constraints: Dict[str, Any],
        faculty_avail_map: Dict[str, str],
        depth: int = 0,
        max_depth: int = 50
    ) -> bool:
        """
        Recursively allocates remaining subject hours.

        Args:
            schedule (Dict): Current class schedule state.
            faculty_schedule (Dict): Current faculty schedule state.
            unallocated_subjects (List): Remaining subjects with hours.
            constraints (Dict): Global constraints.
            faculty_avail_map (Dict): Faculty availability details.
            depth (int): Current recursion depth.
            max_depth (int): Max allowed recursion depth.

        Returns:
            bool: True if all subjects are fully scheduled, False otherwise.
        """
        # If no unallocated hours remain, we succeeded!
        active_unallocated = [s for s in unallocated_subjects if s["remaining_hours"] > 0]
        if not active_unallocated:
            return True

        if depth >= max_depth:
            logger.warning(f"Backtracking reached max recursion depth ({max_depth}). Stopping branch.")
            return False

        # Pick the first unallocated subject (sorted by remaining hours descending)
        active_unallocated.sort(key=lambda x: x["remaining_hours"], reverse=True)
        target_subject = active_unallocated[0]

        class_name = target_subject["class_name"]
        subj_name = target_subject["subject_name"]
        fac_name = target_subject["faculty_name"]
        subj_type = target_subject["subject_type"]

        working_days = [d.strip() for d in str(constraints.get("working_days", "Monday,Tuesday,Wednesday,Thursday,Friday")).split(",") if d.strip()]
        periods_per_day = int(constraints.get("periods_per_day", 7))
        lunch_break = int(constraints.get("lunch_break", 4))
        break_period = int(constraints.get("break_period", 2))

        # Generate list of slots
        slots = []
        for day in working_days:
            for period in range(1, periods_per_day + 1):
                if period != lunch_break and period != break_period:
                    slots.append((day, period))

        # Shuffle to increase search space coverage
        random.shuffle(slots)

        # Try to place directly in any free slot
        for day, period in slots:
            # Check if class is empty at this slot
            if schedule[class_name][day][period] is None:
                # Check if this placement is valid (no faculty clash)
                if ConflictChecker.is_valid_assignment(
                    schedule, faculty_schedule, class_name, subj_name, fac_name, day, period, constraints, faculty_avail_map
                ):
                    # Place subject
                    schedule[class_name][day][period] = {
                        "id": target_subject["id"],
                        "subject": subj_name,
                        "faculty": fac_name,
                        "type": subj_type
                    }
                    faculty_schedule[fac_name][day][period] = class_name
                    target_subject["remaining_hours"] -= 1

                    # Recurse
                    if cls.solve(schedule, faculty_schedule, unallocated_subjects, constraints, faculty_avail_map, depth + 1, max_depth):
                        return True

                    # Rollback
                    schedule[class_name][day][period] = None
                    if period in faculty_schedule[fac_name][day]:
                        del faculty_schedule[fac_name][day][period]
                    target_subject["remaining_hours"] += 1

        # Direct placement failed. Try to shift conflicting faculty allocations.
        # Find slots where class is empty but faculty is busy elsewhere.
        for day, period in slots:
            if schedule[class_name][day][period] is None:
                # Is faculty busy at this time?
                busy_class = faculty_schedule[fac_name][day].get(period)
                if busy_class and busy_class != class_name:
                    # Let's see if we can move busy_class's lecture from (day, period) to an alternative slot
                    conflicting_lecture = schedule[busy_class][day][period]
                    if conflicting_lecture:
                        conflicting_subj_name = conflicting_lecture["subject"]
                        conflicting_fac_name = conflicting_lecture["faculty"]
                        
                        # Find alternative free slot in busy_class's schedule
                        for alt_day, alt_period in slots:
                            if (alt_day == day and alt_period == period) or alt_period == lunch_break or alt_period == break_period:
                                continue

                            # Is the alt slot free for busy_class?
                            if schedule[busy_class][alt_day][alt_period] is None:
                                # Can we move conflicting lecture to the alt slot?
                                if ConflictChecker.is_valid_assignment(
                                    schedule, faculty_schedule, busy_class, conflicting_subj_name,
                                    conflicting_fac_name, alt_day, alt_period, constraints, faculty_avail_map
                                ):
                                    # Perform the shift
                                    # 1. Unschedule from current slot
                                    schedule[busy_class][day][period] = None
                                    del faculty_schedule[conflicting_fac_name][day][period]

                                    # 2. Place in new alt slot
                                    schedule[busy_class][alt_day][alt_period] = conflicting_lecture
                                    faculty_schedule[conflicting_fac_name][alt_day][alt_period] = busy_class

                                    # 3. Now try to assign target subject to the freed slot
                                    if ConflictChecker.is_valid_assignment(
                                        schedule, faculty_schedule, class_name, subj_name, fac_name, day, period, constraints, faculty_avail_map
                                    ):
                                        schedule[class_name][day][period] = {
                                            "id": target_subject["id"],
                                            "subject": subj_name,
                                            "faculty": fac_name,
                                            "type": subj_type
                                        }
                                        faculty_schedule[fac_name][day][period] = class_name
                                        target_subject["remaining_hours"] -= 1

                                        # Recurse
                                        if cls.solve(schedule, faculty_schedule, unallocated_subjects, constraints, faculty_avail_map, depth + 1, max_depth):
                                            return True

                                        # Rollback target assignment
                                        schedule[class_name][day][period] = None
                                        if period in faculty_schedule[fac_name][day]:
                                            del faculty_schedule[fac_name][day][period]
                                        target_subject["remaining_hours"] += 1

                                    # Rollback the shift
                                    schedule[busy_class][alt_day][alt_period] = None
                                    if alt_period in faculty_schedule[conflicting_fac_name][alt_day]:
                                        del faculty_schedule[conflicting_fac_name][alt_day][alt_period]

                                    schedule[busy_class][day][period] = conflicting_lecture
                                    faculty_schedule[conflicting_fac_name][day][period] = busy_class

        return False
