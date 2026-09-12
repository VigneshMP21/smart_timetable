"""
Purpose: Class/Section SQLAlchemy Database Model
Author: Smart Timetable Backend Team
Module Description: Implements the database schema for storing Classes
(academic divisions like CSE-A). Each class has a full name, a short code
and a section; records are owned by the user who created them.

Database interaction:
  - Table  : classes
  - Columns: id, class_name, short_code, section, created_by, created_at,
             updated_at
  - Keys   : (class_name, section) and (short_code, section) are unique.
             created_by is a nullable FK to profiles.id (the Supabase user's
             UUID) and is null when the creating user was deleted.

Future extension:
  - Add a `status` column for soft-delete or a `department` column when the
    Room/Subject modules are introduced.
"""

from datetime import datetime
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Class(Base):
    """
    SQLAlchemy model representing an Academic Class or Section (e.g. CSE-A).
    """

    __tablename__ = "classes"
    __table_args__ = (
        UniqueConstraint("class_name", "section", name="uq_classes_class_name_section"),
        UniqueConstraint("short_code", "section", name="uq_classes_short_code_section"),
        Index("idx_classes_class_name", "class_name"),
        Index("idx_classes_short_code", "short_code"),
        Index("idx_classes_section", "section"),
        Index("idx_classes_created_by", "created_by"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_name: Mapped[str] = mapped_column(String(100), nullable=False)
    short_code: Mapped[str] = mapped_column(String(20), nullable=False)
    section: Mapped[str] = mapped_column(String(20), nullable=False)
    created_by: Mapped[object] = mapped_column(
        Uuid, ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True, index=True
    )

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
        return (
            f"<Class(id={self.id}, class_name='{self.class_name}', "
            f"short_code='{self.short_code}', section='{self.section}')>"
        )
