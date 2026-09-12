"""
Purpose: App Custom Exceptions
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Defines clean custom exception classes used across validation, database operations, and scheduling routines.
"""

from typing import List, Dict, Any


class TimetableException(Exception):
    """
    Base exception class for all custom scheduler exceptions.
    """
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class TimetableEditValidationError(TimetableException):
    """
    Exception raised when a manual timetable edit fails validation.
    Carries the structured list of per-cell conflict messages.
    """
    def __init__(self, message: str, errors: List[str]):
        super().__init__(message)
        self.errors = errors


class ExcelValidationError(TimetableException):
    """
    Exception raised when uploaded excel file validation fails.
    Contains a list of structured, detailed errors.
    """
    def __init__(self, message: str, errors: List[Dict[str, Any]]):
        super().__init__(message)
        self.errors = errors


class DatabaseError(TimetableException):
    """
    Exception raised when an operation on the database fails.
    """
    pass


class SchedulingFailureError(TimetableException):
    """
    Exception raised when the scheduler fails to generate a conflict-free 
    timetable after exhausting retries.
    """
    pass


class ConflictError(TimetableException):
    """
    Exception raised when a constraint clash is detected.
    """
    pass
