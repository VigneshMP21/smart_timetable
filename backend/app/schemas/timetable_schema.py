"""
Purpose: Timetable Entry and Response Pydantic Schemas
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Defines validation structures for timetable entries,
manual-edit payloads and structured generation / query responses.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict


class TimetableSlot(BaseModel):
    """
    A single timetable cell. Break / lunch / free slots carry type markers and
    null subject/faculty ids.
    """
    period: int = Field(..., description="Period number (1-indexed)")
    subject: str = Field(..., description="Subject name or Break / Lunch Break / Free Period")
    subject_code: Optional[str] = Field(None, description="Subject code, if any")
    faculty: str = Field(..., description="Faculty name or '-'")
    room: Optional[str] = Field(None, description="Room number, if any")
    start_time: Optional[str] = Field(None, description="Period start time (HH:MM)")
    end_time: Optional[str] = Field(None, description="Period end time (HH:MM)")
    type: str = Field(..., description="Theory / Lab / Elective / Break / Lunch / Free")
    subject_id: Optional[str] = Field(None, description="Subject uuid, if any")
    faculty_id: Optional[str] = Field(None, description="Faculty uuid, if any")


class ClassInfo(BaseModel):
    """
    Lightweight class metadata included in every timetable response so the
    frontend can render headers and navigate without extra lookups.
    """
    class_id: int
    class_name: str
    short_code: str
    section: str
    room_no: Optional[str] = None


class TimetableGenerationResponse(BaseModel):
    """
    Structured timetable output: status, message, entry count and the nested
    Class -> Day -> list of TimetableSlot mapping.
    """
    status: str = Field(..., description="Status of generation (success/failed)")
    message: str = Field(..., description="Feedback message")
    entries_count: int = Field(..., description="Number of entries created")
    classes: List[ClassInfo] = Field(default_factory=list, description="Class metadata list")
    config: Dict[str, Any] = Field(default_factory=dict, description="Setup configuration used")
    timetable: Dict[str, Dict[str, List[TimetableSlot]]] = Field(
        ...,
        description="Structured timetable nested by Class -> Day -> list of periods"
    )


class TimetableEditEntry(BaseModel):
    """
    A single edited cell submitted by the user. subject_id / faculty_id / room_no
    are optional because break, lunch and free cells have no allocation.
    """
    day: str = Field(..., description="Day of the week (e.g. Monday)")
    period: int = Field(..., description="Period number (1-indexed)")
    subject_id: Optional[str] = Field(None, description="Subject uuid, or null for non-teaching slots")
    faculty_id: Optional[str] = Field(None, description="Faculty uuid, or null for non-teaching slots")
    room_no: Optional[str] = Field(None, description="Room number, or null to inherit the class room")


class TimetableUpdateRequest(BaseModel):
    """
    Full-grid replacement for one class. All cells of the class's weekly
    schedule must be provided; non-teaching cells carry null subject/faculty.
    """
    class_id: int = Field(..., description="ID of the class being edited")
    entries: List[TimetableEditEntry] = Field(..., description="All timetable cells for the class")


class PreviewResponse(BaseModel):
    classes: List[Dict[str, Any]]
    subjects: List[Dict[str, Any]]
    faculty: List[Dict[str, Any]]
    rooms: List[Dict[str, Any]]
    config: Optional[Dict[str, Any]] = None
