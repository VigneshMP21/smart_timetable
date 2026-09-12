"""
Purpose: Date and Time Utilities
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Provides helper functions for timestamp retrieval, formatting, and time calculations.
"""

from datetime import datetime, timezone


def get_current_utc_time() -> datetime:
    """
    Returns the current datetime in UTC timezone.

    Returns:
        datetime: Offset-aware datetime representing current UTC time.
    """
    return datetime.now(timezone.utc)


def format_datetime(dt: datetime, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """
    Formats a datetime object to a readable string format.

    Args:
        dt (datetime): The datetime to format.
        fmt (str): The format string template.

    Returns:
        str: The formatted datetime string.
    """
    if dt is None:
        return ""
    if dt.tzinfo is None:
        # If naive, treat as UTC
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime(fmt)


def get_timestamp_string() -> str:
    """
    Generates a unique timestamp string suitable for appending to filenames.

    Returns:
        str: String containing date and time in YYYYMMDD_HHMMSS format.
    """
    return datetime.now().strftime("%Y%m%d_%H%M%S")
