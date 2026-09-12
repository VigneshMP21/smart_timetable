"""
Purpose: Lab Allocation Service
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Allocates consecutive period blocks for Lab subjects.
"""

from typing import Dict, Any, List, Tuple, Optional
from app.utils.logger import get_logger
from app.services.conflict_checker import ConflictChecker

logger = get_logger(__name__)


class LabAllocator:
    """
    Finds contiguous periods to schedule practical and laboratory courses.
    """

    @staticmethod
    def find_consecutive_slots(
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        faculty_schedule: Dict[str, Dict[str, Dict[int, str]]],
        class_name: str,
        subject_name: str,
        faculty_name: str,
        duration: int,
        constraints: Dict[str, Any],
        faculty_avail_map: Dict[str, str]
    ) -> List[Tuple[str, List[int]]]:
        """
        Finds all possible slot allocations for a lab of a given duration.

        Args:
            schedule (Dict): Class timetable map.
            faculty_schedule (Dict): Faculty schedule tracker.
            class_name (str): The class name.
            subject_name (str): Lab subject name.
            faculty_name (str): Lab faculty.
            duration (int): Consecutive periods needed (e.g. 3).
            constraints (Dict): Global constraints.
            faculty_avail_map (Dict): Faculty availability mapping.

        Returns:
            List[Tuple[str, List[int]]]: List of tuples containing (day, [list of periods]).
        """
        working_days = [d.strip() for d in str(constraints.get("working_days", "Monday,Tuesday,Wednesday,Thursday,Friday")).split(",") if d.strip()]
        periods_per_day = int(constraints.get("periods_per_day", 7))
        lunch_break = int(constraints.get("lunch_break", 4))
        break_period = int(constraints.get("break_period", 2))

        possible_options = []

        for day in working_days:
            # We search for a sequence of periods [p, p+1, ..., p+duration-1]
            # that are consecutive and do not cross lunch_break or break_period,
            # and are valid for both the class and the faculty.
            for start_p in range(1, periods_per_day - duration + 2):
                periods = list(range(start_p, start_p + duration))
                
                # Check if any period in this range is a break or lunch
                if any(p == lunch_break or p == break_period for p in periods):
                    continue

                # Check if all periods in this range are valid conflict-free assignments
                is_valid_block = True
                for p in periods:
                    # We pass is_lab=True to bypass individual consecutive limits since we are allocating a lab block
                    if not ConflictChecker.is_valid_assignment(
                        schedule,
                        faculty_schedule,
                        class_name,
                        subject_name,
                        faculty_name,
                        day,
                        p,
                        constraints,
                        faculty_avail_map,
                        is_lab=True
                    ):
                        is_valid_block = False
                        break

                if is_valid_block:
                    possible_options.append((day, periods))

        return possible_options
