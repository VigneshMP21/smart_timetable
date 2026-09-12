"""
Purpose: Class/Section Pydantic Schemas
Author: Smart Timetable Backend Team
Module Description: Defines validation structures for the Add Class module.

Workflow:
  - ClassCreate        : single record (manual entry / one Excel row).
  - BulkClassCreate    : batch of records for the Excel "Save to database".
  - ClassResponse      : serialized class row returned by GET /classes.
  - ClassRecord        : a parsed, validated Excel row (preview only).

  - ClassUpdate        : optional fields for editing an existing class.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _strip(value: str) -> str:
    """Strip and collapse whitespace on a user-entered string field."""
    return " ".join(str(value).split())


class ClassCreate(BaseModel):
    """
    A single class record submitted by manual entry or extracted from Excel.
    """

    class_name: str = Field(..., min_length=1, max_length=100, description="Full class/branch name")
    short_code: str = Field(..., min_length=1, max_length=20, description="Class/branch short code")
    section: str = Field(..., min_length=1, max_length=20, description="Section label (e.g. A)")

    @field_validator("class_name", "short_code", "section")
    @classmethod
    def normalize(cls, value: str) -> str:
        cleaned = _strip(value)
        if not cleaned:
            raise ValueError("Field cannot be empty.")
        return cleaned


class BulkClassCreate(BaseModel):
    """
    Batch payload used by the Excel flow's "Save to Database" step.
    """

    records: List[ClassCreate] = Field(..., min_length=1, description="Class records to insert")


class CreateClassesRequest(BaseModel):
    """
    Flexible body for POST /classes/create.

    Accepts either a batch ({records: [...]}) for the Excel save step or a
    single class via the direct fields for manual entry.
    """

    records: Optional[List[ClassCreate]] = Field(None, description="Batch of class records")
    class_name: Optional[str] = Field(None, min_length=1, max_length=100)
    short_code: Optional[str] = Field(None, min_length=1, max_length=20)
    section: Optional[str] = Field(None, min_length=1, max_length=20)


class ClassUpdate(BaseModel):
    """
    Payload for PUT /classes/{id}. All fields are optional; only the provided
    fields are updated.
    """

    class_name: Optional[str] = Field(None, min_length=1, max_length=100)
    short_code: Optional[str] = Field(None, min_length=1, max_length=20)
    section: Optional[str] = Field(None, min_length=1, max_length=20)

    @field_validator("class_name", "short_code", "section")
    @classmethod
    def normalize(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _strip(value)
        if not cleaned:
            raise ValueError("Field cannot be empty.")
        return cleaned


class ClassRecord(BaseModel):
    """
    A validated Excel row shown in the upload preview before saving.
    """

    class_name: str
    short_code: str
    section: str
    errors: List[str] = Field(default_factory=list, description="Per-row validation issues")


class ClassUploadResult(BaseModel):
    """
    Response shape for POST /classes/upload (parse + validate + preview).
    """

    status: str
    message: str
    records: List[ClassRecord]
    error_count: int = 0


class ClassResponse(BaseModel):
    """
    Serialized class row returned to the frontend.
    """

    id: int
    class_name: str
    short_code: str
    section: str
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClassBatchDeleteRequest(BaseModel):
    """
    Payload for POST /classes/delete-batch.
    """

    ids: List[int] = Field(..., min_length=1, description="Class ids to delete")
