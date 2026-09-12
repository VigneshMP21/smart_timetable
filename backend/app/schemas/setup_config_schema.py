"""
Purpose: Setup Configuration Pydantic Schemas
Author: Smart Timetable Backend Team
Module Description: Defines the payload shapes for reading and persisting a
user's Setup (timetable configuration). The raw JSONB document is stored
exactly as the frontend produces it (camelCase keys); the backend normalizes
it internally when generating.
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class SetupConfigResponse(BaseModel):
    """
    Returns the persisted configuration document plus a status flag. `exists`
    lets the frontend distinguish "no config saved yet" from an empty object.
    """
    exists: bool = Field(..., description="True when the user has saved a configuration")
    config: Dict[str, Any] = Field(..., description="The raw configuration document")
    updated_at: Optional[str] = Field(None, description="Last saved timestamp, if any")


class SetupConfigUpdateRequest(BaseModel):
    """
    Payload for saving a Setup configuration. The whole document is replaced.
    """
    config: Dict[str, Any] = Field(..., description="The raw configuration document to persist")
