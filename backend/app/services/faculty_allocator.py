"""
Purpose: Faculty Workload and Allocation Manager Service
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Manages faculty weekly schedules, query utilities, and workload balancing bounds.
"""

from typing import Dict, List, Any
from app.utils.logger import get_logger

logger = get_logger(__name__)


class FacultyAllocator:
    """
    Manages allocations and monitors weekly hours for all instructors.
    """

    def __init__(self, faculty_list: List[Dict[str, Any]]):
        self.faculty_list = faculty_list
        self.faculty_names = [f["FacultyName"] for f in faculty_list]
        self.faculty_by_name = {f["FacultyName"]: f for f in faculty_list}
        self.weekly_workload: Dict[str, int] = {name: 0 for name in self.faculty_names}

    def increment_workload(self, faculty_name: str, hours: int = 1) -> None:
        """Increments the scheduled weekly hours for a faculty member."""
        if faculty_name in self.weekly_workload:
            self.weekly_workload[faculty_name] += hours

    def decrement_workload(self, faculty_name: str, hours: int = 1) -> None:
        """Decrements the scheduled weekly hours for a faculty member."""
        if faculty_name in self.weekly_workload:
            self.weekly_workload[faculty_name] = max(0, self.weekly_workload[faculty_name] - hours)

    def get_workload(self, faculty_name: str) -> int:
        """Returns the current weekly workload (in periods) for a faculty member."""
        return self.weekly_workload.get(faculty_name, 0)

    def get_available_days(self, faculty_name: str) -> str:
        """Retrieves the availability configuration string for a faculty member."""
        faculty = self.faculty_by_name.get(faculty_name)
        if faculty:
            return faculty.get("Available", "All")
        return "All"
