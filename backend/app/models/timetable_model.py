"""
Purpose: Timetable Entry SQLAlchemy Database Model
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Implements the database schema for the final generated
schedule entries. Entries store the allocated subject/faculty/room for a
given class, day and period, plus the period's timing. Break and lunch slots
are stored as entries with is_break / is_lunch flags and NULL subject/faculty.
"""

from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class TimetableEntry(Base):
    """
    SQLAlchemy model representing a single allocated slot in the generated timetable.
    """
    __tablename__ = "timetable_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[object] = mapped_column(Uuid, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=True)
    faculty_id: Mapped[object] = mapped_column(Uuid, ForeignKey("faculties.id", ondelete="CASCADE"), nullable=True)
    room_no: Mapped[str] = mapped_column(String(100), nullable=True)
    day: Mapped[str] = mapped_column(String(50), nullable=False)  # Monday, Tuesday, etc.
    period: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-indexed (e.g. 1 to 9)
    start_time: Mapped[str] = mapped_column(String(20), nullable=True)  # "09:00"
    end_time: Mapped[str] = mapped_column(String(20), nullable=True)  # "09:50"
    is_break: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=func.false())
    is_lunch: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=func.false())
    created_by: Mapped[object] = mapped_column(
        Uuid,
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    academic_class = relationship("Class", backref="timetable_entries")
    subject = relationship("Subject", backref="timetable_entries")
    faculty = relationship("Faculty", backref="timetable_entries")

    def __repr__(self) -> str:
        return f"<TimetableEntry(id={self.id}, class_id={self.class_id}, day='{self.day}', period={self.period})>"
