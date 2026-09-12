"""
Purpose: Room Pydantic Schemas
Author: Smart Timetable Backend Team
Module Description: Defines validation structures for the Add Room module.

Workflow:
  - RoomCreate        : single record (manual entry / one Excel row).
  - CreateRoomsRequest: flexible body accepting a batch or a single record.
  - RoomResponse      : serialized room row returned by GET /rooms.
  - RoomRecord        : a parsed, validated Excel row (preview only).
  - RoomUpdate        : optional fields for editing an existing room.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _strip(value: str) -> str:
    """Strip and collapse whitespace on a user-entered string field."""
    return " ".join(str(value).split())


def _normalize_code(value: Optional[str]) -> Optional[str]:
    """Normalize an optional short code / section value (uppercased)."""
    if value is None:
        return None
    cleaned = _strip(value).upper()
    return cleaned or None


class RoomCreate(BaseModel):
    """
    A single room record submitted by manual entry or extracted from Excel.
    """

    room_no: str = Field(..., min_length=1, max_length=100, description="Room number/code")
    class_short_code: Optional[str] = Field(None, max_length=20, description="Class/branch short code of the room")
    section: Optional[str] = Field(None, max_length=20, description="Section label of the room (e.g. A)")
    class_id: Optional[int] = Field(None, description="Optional class assigned to this room")

    @field_validator("room_no")
    @classmethod
    def normalize(cls, value: str) -> str:
        cleaned = _strip(value)
        if not cleaned:
            raise ValueError("Field cannot be empty.")
        return cleaned

    @field_validator("class_short_code", "section")
    @classmethod
    def normalize_optional(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_code(value)


class CreateRoomsRequest(BaseModel):
    """
    Flexible body for POST /rooms/create.

    Accepts either a batch ({records: [...]}) for the Excel save step or a
    single room via the direct fields for manual entry.
    """

    records: Optional[List[RoomCreate]] = Field(None, description="Batch of room records")
    room_no: Optional[str] = Field(None, min_length=1, max_length=100)
    class_short_code: Optional[str] = Field(None, max_length=20)
    section: Optional[str] = Field(None, max_length=20)
    class_id: Optional[int] = Field(None, description="Optional class assigned to this room")


class RoomUpdate(BaseModel):
    """
    Payload for PUT /rooms/{id}. All fields are optional; only the provided
    fields are updated. class_id may be explicitly set to null to clear an
    existing class assignment.
    """

    room_no: Optional[str] = Field(None, min_length=1, max_length=100)
    class_short_code: Optional[str] = Field(None, max_length=20)
    section: Optional[str] = Field(None, max_length=20)
    class_id: Optional[int] = Field(None, description="Class to assign, or null to clear")

    @field_validator("room_no")
    @classmethod
    def normalize(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _strip(value)
        if not cleaned:
            raise ValueError("Field cannot be empty.")
        return cleaned

    @field_validator("class_short_code", "section")
    @classmethod
    def normalize_optional(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_code(value)


class RoomRecord(BaseModel):
    """
    A validated Excel row shown in the upload preview before saving.
    """

    room_no: str
    class_short_code: Optional[str] = None
    section: Optional[str] = None
    errors: List[str] = Field(default_factory=list, description="Per-row validation issues")


class RoomUploadResult(BaseModel):
    """
    Response shape for POST /rooms/upload (parse + validate + preview).
    """

    status: str
    message: str
    records: List[RoomRecord]
    error_count: int = 0


class RoomResponse(BaseModel):
    """
    Serialized room row returned to the frontend.
    """

    id: int
    room_no: str
    class_short_code: Optional[str] = None
    section: Optional[str] = None
    class_id: Optional[int] = None
    class_name: Optional[str] = Field(None, description="Name of the assigned class (list only)")
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RoomBatchDeleteRequest(BaseModel):
    """
    Payload for POST /rooms/delete-batch.
    """

    ids: List[int] = Field(..., min_length=1, description="Room ids to delete")
