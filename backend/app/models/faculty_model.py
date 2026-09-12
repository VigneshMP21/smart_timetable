"""
Purpose: Faculty SQLAlchemy Database Model
Author: Smart Timetable Backend Team
Module Description: Implements the database schema for academic Faculty
assignments. Each faculty member is assigned to exactly one subject and to
one or more branches (classes short codes, e.g. CSE, ECE).

Database interaction:
  - Table  : faculties
  - Columns: id (uuid), faculty_name, subject_id (uuid FK -> subjects.id),
             branch_classes (text[]), created_by, created_at, updated_at
  - Keys   : A faculty member may appear in several rows, but the unique
             index on (lower(faculty_name), subject_id) guarantees the same
             faculty is never assigned the same subject twice.
             subject_id cascades when the referenced subject is deleted;
             created_by is a nullable FK to profiles.id (the Supabase user's
             UUID) and is null when the creating user was deleted.

Future extension:
  - Add workload / availability columns (e.g. max_hours_per_week) when the
    timetable generator module is introduced.
"""

from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, String, Uuid, func, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Faculty(Base):
    """
    SQLAlchemy model representing a faculty assignment (faculty -> subject ->
    one or more branches).
    """

    __tablename__ = "faculties"
    __table_args__ = (
        Index("idx_faculties_faculty_name", "faculty_name"),
        Index("idx_faculties_subject_id", "subject_id"),
        Index("idx_faculties_created_by", "created_by"),
    )

    id: Mapped[object] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    faculty_name: Mapped[str] = mapped_column(String(200), nullable=False)
    subject_id: Mapped[object] = mapped_column(
        Uuid, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section: Mapped[object] = mapped_column(String(20), nullable=True)
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

    subject = relationship("Subject", backref="faculties")

    def __repr__(self) -> str:
        return (
            f"<Faculty(id={self.id}, name='{self.faculty_name}', "
            f"subject_id={self.subject_id}, branches={self.branch_classes})>"
        )
