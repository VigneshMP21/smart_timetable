"""
Purpose: Subject SQLAlchemy Database Model
Author: Smart Timetable Backend Team
Module Description: Implements the database schema for academic Subjects.
Each subject has a unique code and name and belongs to one or more branches
(classes short codes, e.g. CSE, ECE).

Database interaction:
  - Table  : subjects
  - Columns: id (uuid), subject_code, subject_name, branch_classes (text[]),
             created_by, created_at, updated_at
  - Keys   : subject_code is unique. branch_classes stores the short codes of
             the branches (classes) the subject applies to. created_by is a
             nullable FK to profiles.id (the Supabase user's UUID) and is null
             when the creating user was deleted.
"""

from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, Uuid, func, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Subject(Base):
    """
    SQLAlchemy model representing an academic Subject (e.g. Data Structures).
    """

    __tablename__ = "subjects"
    __table_args__ = (
        UniqueConstraint("subject_code", name="uq_subjects_subject_code"),
        Index("idx_subjects_subject_code", "subject_code"),
        Index("idx_subjects_subject_name", "subject_name"),
        Index("idx_subjects_created_by", "created_by"),
    )

    id: Mapped[object] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    subject_code: Mapped[str] = mapped_column(String(50), nullable=False)
    subject_name: Mapped[str] = mapped_column(String(200), nullable=False)
    branch_classes: Mapped[list] = mapped_column(
        ARRAY(String(20)), nullable=False, server_default=text("'{}'::text[]")
    )
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
            f"<Subject(id={self.id}, code='{self.subject_code}', "
            f"name='{self.subject_name}', branches={self.branch_classes})>"
        )
