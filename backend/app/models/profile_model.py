"""
Purpose: Profile Database Model (Supabase-linked)
Author: Smart Timetable Backend Team
Module Description: SQLAlchemy model for the public "profiles" table.

The profiles table stores application-specific information about a user and
is linked 1:1 to Supabase Auth's auth.users table via the primary key (the
user's UUID). There is no custom local users table; authentication is owned
by Supabase Auth and the backend only manages profile data.

The foreign key to auth.users.id is declared at the database level (see
database/schema/supabase.sql), not in the ORM, because auth.users lives
outside this application's SQLAlchemy metadata.

A profile row is created lazily by the backend on the user's first
authenticated request (and/or by a database trigger on auth.users signup).
"""

from datetime import datetime
from sqlalchemy import (
    DateTime,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Profile(Base):
    """
    SQLAlchemy model representing a user's profile row.

    id equals the Supabase auth.users.id (UUID) for the same user.
    """

    __tablename__ = "profiles"

    id: Mapped[object] = mapped_column(Uuid, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    college_name: Mapped[str] = mapped_column(String(300), nullable=True, default="")
    department: Mapped[str] = mapped_column(String(200), nullable=True, default="")
    phone_number: Mapped[str] = mapped_column(String(30), nullable=True, default="")
    profile_image: Mapped[str] = mapped_column(String(500), nullable=True, default="")
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="user")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Profile(id={self.id}, role='{self.role}')>"
