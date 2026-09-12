"""
Purpose: Subject Pydantic Schemas
Author: Smart Timetable Backend Team
Module Description: Defines validation structures for the Add Subject module.

Workflow:
  - SubjectCreate        : single record (manual entry / one Excel row).
  - CreateSubjectsRequest: flexible body accepting a batch or a single record.
  - SubjectResponse      : serialized subject row returned by GET /subjects.
  - SubjectRecord        : a parsed, validated Excel row (preview only).
  - SubjectUpdate        : optional fields for editing an existing subject.
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
    Normalize a list of branch/class short codes: strip, uppercase, de-dupe,
    preserving order.
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


class SubjectCreate(BaseModel):
    """
    A single subject record submitted by manual entry or extracted from Excel.
    """

    subject_code: str = Field(..., min_length=1, max_length=50, description="Unique subject code")
    subject_name: str = Field(..., min_length=1, max_length=200, description="Full subject name")
    branch_classes: List[str] = Field(
        ..., min_length=1, description="Branch short codes (e.g. ['CSE', 'ECE'])"
    )

    @field_validator("subject_code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        cleaned = _strip(value).upper()
        if not cleaned:
            raise ValueError("Subject code cannot be empty.")
        return cleaned

    @field_validator("subject_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        cleaned = _strip(value)
        if not cleaned:
            raise ValueError("Subject name cannot be empty.")
        return cleaned

    @field_validator("branch_classes")
    @classmethod
    def normalize_branches(cls, values: List[str]) -> List[str]:
        cleaned = _clean_branches(values)
        if not cleaned:
            raise ValueError("Select at least one branch/class.")
        return cleaned


class CreateSubjectsRequest(BaseModel):
    """
    Flexible body for POST /subjects/create.

    Accepts either a batch ({records: [...]}) for the Excel save step or a
    single subject via the direct fields for manual entry.
    """

    records: Optional[List[SubjectCreate]] = Field(None, description="Batch of subject records")
    subject_code: Optional[str] = Field(None, min_length=1, max_length=50)
    subject_name: Optional[str] = Field(None, min_length=1, max_length=200)
    branch_classes: Optional[List[str]] = Field(None, min_length=1)


class SubjectUpdate(BaseModel):
    """
    Payload for PUT /subjects/{id}. All fields are optional; only the provided
    fields are updated.
    """

    subject_code: Optional[str] = Field(None, min_length=1, max_length=50)
    subject_name: Optional[str] = Field(None, min_length=1, max_length=200)
    branch_classes: Optional[List[str]] = Field(None, min_length=1)

    @field_validator("subject_code")
    @classmethod
    def normalize_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _strip(value).upper()
        if not cleaned:
            raise ValueError("Subject code cannot be empty.")
        return cleaned

    @field_validator("subject_name")
    @classmethod
    def normalize_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _strip(value)
        if not cleaned:
            raise ValueError("Subject name cannot be empty.")
        return cleaned

    @field_validator("branch_classes")
    @classmethod
    def normalize_branches(cls, values: Optional[List[str]]) -> Optional[List[str]]:
        if values is None:
            return None
        cleaned = _clean_branches(values)
        if not cleaned:
            raise ValueError("Select at least one branch/class.")
        return cleaned


class SubjectRecord(BaseModel):
    """
    A validated Excel row shown in the upload preview before saving.
    """

    subject_code: str
    subject_name: str
    branch_classes: List[str]
    errors: List[str] = Field(default_factory=list, description="Per-row validation issues")


class SubjectUploadResult(BaseModel):
    """
    Response shape for POST /subjects/upload (parse + validate + preview).
    """

    status: str
    message: str
    records: List[SubjectRecord]
    error_count: int = 0


class SubjectResponse(BaseModel):
    """
    Serialized subject row returned to the frontend.
    """

    id: UUID
    subject_code: str
    subject_name: str
    branch_classes: List[str]
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubjectBatchDeleteRequest(BaseModel):
    """
    Payload for POST /subjects/delete-batch.
    """

    ids: List[UUID] = Field(..., min_length=1, description="Subject ids to delete")
