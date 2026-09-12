"""
Purpose: Centralized Constants Mappings
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Stores global application constants, standard weekdays, subject types, and fallback configuration values.
"""

from typing import List

# Days of the Week configuration
DAYS_OF_WEEK: List[str] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
]

# Standard weekdays used if none specified
DEFAULT_WORKING_DAYS: List[str] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday"
]

# Subject Type Constants
SUBJECT_TYPE_THEORY: str = "Theory"
SUBJECT_TYPE_LAB: str = "Lab"
SUBJECT_TYPE_ELECTIVE: str = "Elective"

VALID_SUBJECT_TYPES: List[str] = [
    SUBJECT_TYPE_THEORY,
    SUBJECT_TYPE_LAB,
    SUBJECT_TYPE_ELECTIVE
]

# Default Constraint Settings
DEFAULT_PERIODS_PER_DAY: int = 7
DEFAULT_LUNCH_BREAK: int = 4
DEFAULT_BREAK_PERIOD: int = 2
DEFAULT_MAX_CONSECUTIVE_CLASSES: int = 3
DEFAULT_MAX_DAILY_HOURS: int = 6
