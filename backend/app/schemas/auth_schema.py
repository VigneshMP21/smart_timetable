"""
Purpose: Authentication Pydantic Schemas
Author: Smart Timetable Backend Team
Module Description: Request/response models for the /auth API routes.

Authentication itself is owned by Supabase Auth (the frontend talks to it via
supabase-js). The backend only exposes the authenticated user's profile row
and mirrors the public "profiles" table.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserInfo(BaseModel):
    """
    Authenticated user information derived from the Supabase JWT claims.
    """

    id: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


class ProfileBase(BaseModel):
    """
    Common profile fields returned to the frontend.
    """

    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    college_name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    phone_number: Optional[str] = None
    profile_image: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProfileResponse(BaseModel):
    """
    Full profile payload for GET /auth/profile and related routes.
    """

    profile: ProfileBase


class ProfileUpdate(BaseModel):
    """
    Fields a user is allowed to change on their own profile.
    """

    full_name: Optional[str] = Field(default=None, max_length=200)
    college_name: Optional[str] = Field(default=None, max_length=300)
    department: Optional[str] = Field(default=None, max_length=200)
    phone_number: Optional[str] = Field(default=None, max_length=30)
    profile_image: Optional[str] = Field(default=None, max_length=500)


class ProfileUpdateResponse(BaseModel):
    """
    Response payload after a successful profile update.
    """

    profile: ProfileBase
    message: str = "Profile updated successfully."


class MessageResponse(BaseModel):
    """
    Generic message envelope for simple endpoints.
    """

    message: str
    success: bool = True
