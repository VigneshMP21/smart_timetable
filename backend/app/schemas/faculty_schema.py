"""
Purpose: Faculty Pydantic Schemas
Author: Smart Timetable Backend Team
Module Description: Defines validation structures for the Add Faculty module.

Workflow:
  - FacultyCreate         : single record (manual entry / one Excel row).
  - CreateFacultiesRequest: flexible body accepting a batch or a single record.
  - FacultyResponse       : serialized faculty row returned by GET /faculties.
  - FacultyRecord         : a parsed, validated Excel row (preview only).
  - FacultyUpdate         : optional fields for editing an existing assignment.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _strip(value: str) -> str:
    """Strip and collapse whitespace on a user-entered string field."""
    return " ".join(str(value).split())


def _clean_branches(values: List[str]) -> List[str]:
    """
    Normalize a list of branch/class tokens: strip, uppercase, de-dupe,
    preserving order. Tokens may be plain short codes ("CSE") or combined
    "CODE-SECTION" values ("CSE-1").
    """
    seen = set()
    result: List[str] = []
    for value in values:
        cleaned = _strip(value).upper()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
    return result


class FacultyCreate(BaseModel):
    """
    A single faculty assignment submitted by manual entry or extracted from
    Excel.

    The subject can be referenced either by its id (manual entry resolves the
    exact record from the searchable dropdown) or by its name (Excel rows only
    carry the human-readable subject name). At least one of the two must be
    provided; when both are given the id wins and the name is treated as a
    display hint.
    """

    faculty_name: str = Field(..., min_length=3, max_length=200, description="Faculty member name")
    subject_name: Optional[str] = Field(None, max_length=200, description="Full subject name")
    subject_id: Optional[UUID] = Field(None, description="Exact subject id (from the subject dropdown)")
    section: Optional[str] = Field(None, max_length=20, description="Legacy: sections are now embedded in branch_classes tokens (e.g. 'CSE-1')")
    branch_classes: List[str] = Field(
        ..., min_length=1, description="Branch/class tokens, optionally combined with a section (e.g. ['CSE-1', 'CSM-2'])"
    )

    @field_validator("faculty_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        cleaned = _strip(value)
        if len(cleaned) < 3:
            raise ValueError("Faculty name must be at least 3 characters.")
        return cleaned

    @field_validator("subject_name")
    @classmethod
    def normalize_subject_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _strip(value)
        return cleaned or None

    @field_validator("section")
    @classmethod
    def normalize_section(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _strip(value).upper()
        return cleaned or None

    @field_validator("branch_classes")
    @classmethod
    def normalize_branches(cls, values: List[str]) -> List[str]:
        cleaned = _clean_branches(values)
        if not cleaned:
            raise ValueError("Select at least one branch/class.")
        return cleaned


class CreateFacultiesRequest(BaseModel):
    """
    Flexible body for POST /faculties/create.

    Accepts either a batch ({records: [...]}) for the Excel save step or a
    single faculty assignment via the direct fields for manual entry.
    """

    records: Optional[List[FacultyCreate]] = Field(None, description="Batch of faculty records")
    faculty_name: Optional[str] = Field(None, min_length=3, max_length=200)
    subject_name: Optional[str] = Field(None, max_length=200)
    subject_id: Optional[UUID] = Field(None)
    section: Optional[str] = Field(None, max_length=20)
    branch_classes: Optional[List[str]] = Field(None, min_length=1)


class FacultyUpdate(BaseModel):
    """
    Payload for PUT /faculties/{id}. All fields are optional; only the provided
    fields are updated.
    """

    faculty_name: Optional[str] = Field(None, min_length=3, max_length=200)
    subject_id: Optional[UUID] = Field(None)
    section: Optional[str] = Field(None, max_length=20, description="Legacy: sections are now embedded in branch_classes tokens")
    branch_classes: Optional[List[str]] = Field(None, min_length=1)

    @field_validator("faculty_name")
    @classmethod
    def normalize_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _strip(value)
        if len(cleaned) < 3:
            raise ValueError("Faculty name must be at least 3 characters.")
        return cleaned

    @field_validator("section")
    @classmethod
    def normalize_section(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _strip(value).upper()
        return cleaned or None

    @field_validator("branch_classes")
    @classmethod
    def normalize_branches(cls, values: Optional[List[str]]) -> Optional[List[str]]:
        if values is None:
            return None
        cleaned = _clean_branches(values)
        if not cleaned:
            raise ValueError("Select at least one branch/class.")
        return cleaned


class FacultyRecord(BaseModel):
    """
    A validated Excel row shown in the upload preview before saving.
    """

    faculty_name: str
    subject_name: str
    subject_id: Optional[UUID] = None
    section: Optional[str] = None
    branch_classes: List[str]
    errors: List[str] = Field(default_factory=list, description="Per-row validation issues")

class FacultyUploadResult(BaseModel):
    """
    Response shape for POST /faculties/upload (parse + validate + preview).
    """

    status: str
    message: str
    records: List[FacultyRecord]
    error_count: int = 0


class FacultyResponse(BaseModel):
    """
    Serialized faculty row returned to the frontend, joined with the assigned
    subject so the table can show the subject name/code without a second call.
    """

    id: UUID
    faculty_name: str
    subject_id: UUID
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    section: Optional[str] = None
    branch_classes: List[str]
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class FacultyBatchDeleteRequest(BaseModel):
    """
    Payload for POST /faculties/delete-batch.
    """

    ids: List[UUID] = Field(..., min_length=1, description="Faculty assignment ids to delete")
