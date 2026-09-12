"""
Purpose: Workload Balancing Service
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Implements heuristics to balance daily class schedules and subject distributions.
"""

from typing import Dict, Any, List
from app.utils.logger import get_logger

logger = get_logger(__name__)


class WorkloadManager:
    """
    Balances student and faculty workload, checking subject frequency limits per day.
    """

    @staticmethod
    def get_subject_daily_count(
        day_schedule: Dict[int, Dict[str, Any]],
        subject_name: str
    ) -> int:
        """
        Counts how many times a subject occurs on a specific day for a class.

        Args:
            day_schedule (Dict): Day schedule for a class.
            subject_name (str): Subject to count.

        Returns:
            int: Number of periods assigned.
        """
        count = 0
        for period, entry in day_schedule.items():
            if entry and entry.get("subject") == subject_name:
                count += 1
        return count

    @classmethod
    def satisfies_distribution_limit(
        cls,
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        class_name: str,
        day: str,
        subject_name: str,
        subject_type: str
    ) -> bool:
        """
        Validates if scheduling another hour of the subject on a day maintains balance.
        For example, a Theory subject should generally not exceed 1 or 2 hours per day.

        Args:
            schedule (Dict): Class timetable map.
            class_name (str): The class name.
            day (str): Target day.
            subject_name (str): Target subject.
            subject_type (str): Type of subject (Theory/Lab/Elective).

        Returns:
            bool: True if workload distribution is satisfactory, False otherwise.
        """
        day_schedule = schedule.get(class_name, {}).get(day, {})
        current_count = cls.get_subject_daily_count(day_schedule, subject_name)

        if subject_type == "Theory":
            # For theory subjects, avoid scheduling more than 1 hour per day if possible.
            # If the weekly hours are high (e.g. > 5) or slots are tight, this constraint
            # can be bypassed or relaxed, but we enforce it as a soft preference check.
            return current_count < 1
        elif subject_type == "Elective":
            return current_count < 1
        
        # Labs are scheduled as consecutive blocks, so their distribution is handled as a single block.
        return True
