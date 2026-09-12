"""
Purpose: Timetable Conflict Checker Service
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Implements rules for detecting scheduling conflicts (faculty clash, class clash, breaks, consecutive limits).
"""

from typing import Dict, Any, Set, List
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ConflictChecker:
    """
    Validates proposed timetable assignments against institutional and algorithmic constraints.
    """

    @staticmethod
    def is_faculty_available_on_day(faculty_avail_days: str, day: str) -> bool:
        """
        Checks if the faculty is available on a specific day.

        Args:
            faculty_avail_days (str): Comma-separated list of days or "All".
            day (str): The day to check.

        Returns:
            bool: True if available, False otherwise.
        """
        if not faculty_avail_days or faculty_avail_days.strip().lower() == "all":
            return True
        available_list = [d.strip().lower() for d in faculty_avail_days.split(",")]
        return day.lower() in available_list

    @classmethod
    def is_valid_assignment(
        cls,
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        faculty_schedule: Dict[str, Dict[str, Dict[int, str]]],
        class_name: str,
        subject_name: str,
        faculty_name: str,
        day: str,
        period: int,
        constraints: Dict[str, Any],
        faculty_avail_map: Dict[str, str],
        is_lab: bool = False
    ) -> bool:
        """
        Checks all constraints to verify if a subject can be scheduled in a slot.

        Args:
            schedule (Dict): Class timetable map.
            faculty_schedule (Dict): Faculty schedule tracker.
            class_name (str): The class name (e.g. CSE-A).
            subject_name (str): Name of the subject.
            faculty_name (str): Assigned faculty.
            day (str): Target day.
            period (int): Target period index.
            constraints (Dict): Global constraints.
            faculty_avail_map (Dict): Map of faculty to availability days.
            is_lab (bool): Whether the subject is a lab.

        Returns:
            bool: True if the assignment is completely valid, False if it causes a clash.
        """
        periods_per_day = int(constraints.get("periods_per_day", 7))
        lunch_break = int(constraints.get("lunch_break", 4))
        break_period = int(constraints.get("break_period", 2))
        max_consec = int(constraints.get("max_consecutive_classes", 3))
        max_daily_hours = int(constraints.get("max_daily_hours", 6))

        # 1. Period Range check
        if period < 1 or period > periods_per_day:
            return False

        # 2. Lunch Break check
        if period == lunch_break:
            return False

        # 3. Break Period check
        if period == break_period:
            return False

        # 4. Class Clash check
        if schedule.get(class_name, {}).get(day, {}).get(period) is not None:
            return False

        # 5. Faculty Clash check
        if faculty_schedule.get(faculty_name, {}).get(day, {}).get(period) is not None:
            return False

        # 6. Faculty Availability check
        avail_days_str = faculty_avail_map.get(faculty_name, "All")
        if not cls.is_faculty_available_on_day(avail_days_str, day):
            return False

        # 7. Max Daily Hours check for Class
        class_day_slots = schedule.get(class_name, {}).get(day, {})
        class_scheduled_hours = sum(1 for p, entry in class_day_slots.items() if entry is not None and p != lunch_break and p != break_period)
        if class_scheduled_hours >= max_daily_hours:
            return False

        # Max Daily Hours check for Faculty
        fac_day_slots = faculty_schedule.get(faculty_name, {}).get(day, {})
        fac_scheduled_hours = len(fac_day_slots)
        if fac_scheduled_hours >= max_daily_hours:
            return False

        # 8. Consecutive lecture check
        if not is_lab:
            if cls._exceeds_consecutive_limit(schedule.get(class_name, {}).get(day, {}), period, max_consec):
                return False
            if cls._exceeds_consecutive_limit_fac(faculty_schedule.get(faculty_name, {}).get(day, {}), period, max_consec):
                return False

        return True

    @staticmethod
    def _exceeds_consecutive_limit(day_schedule: Dict[int, Dict[str, Any]], period: int, max_consec: int) -> bool:
        """Helper to check if placing an entry at period exceeds the consecutive limit for a class."""
        consec_count = 1
        
        # Check forward
        p = period + 1
        while day_schedule.get(p) is not None:
            consec_count += 1
            p += 1
            
        # Check backward
        p = period - 1
        while day_schedule.get(p) is not None:
            consec_count += 1
            p -= 1
            
        return consec_count > max_consec

    @staticmethod
    def _exceeds_consecutive_limit_fac(fac_day_schedule: Dict[int, str], period: int, max_consec: int) -> bool:
        """Helper to check if placing an entry at period exceeds the consecutive limit for a faculty."""
        consec_count = 1
        
        # Check forward
        p = period + 1
        while fac_day_schedule.get(p) is not None:
            consec_count += 1
            p += 1
            
        # Check backward
        p = period - 1
        while fac_day_schedule.get(p) is not None:
            consec_count += 1
            p -= 1
            
        return consec_count > max_consec
