"""
Purpose: Room SQLAlchemy Database Model
Author: Smart Timetable Backend Team
Module Description: Implements the database schema for storing Rooms (lecture
halls, labs, seminar rooms). Only the room number is stored for now; capacity
and type columns will be added in a future release.

Database interaction:
  - Table  : rooms
  - Columns: id, room_no, class_id, created_by, created_at, updated_at
  - Keys   : room_no is unique; class_id is unique so a class can be assigned
             to at most one room. created_by is a nullable FK to profiles.id
             (the Supabase user's UUID) and is null when the creating user
             was deleted.
"""

from datetime import datetime
from sqlalchemy import (
    BigInteger,
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


class Room(Base):
    """
    SQLAlchemy model representing a Room (e.g. A-101, Physics Lab).
    """

    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint("room_no", name="uq_rooms_room_no"),
        UniqueConstraint("class_id", name="uq_rooms_class_id"),
        Index("idx_rooms_room_no", "room_no"),
        Index("idx_rooms_class_id", "class_id"),
        Index("idx_rooms_created_by", "created_by"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_no: Mapped[str] = mapped_column(String(100), nullable=False)
    class_short_code: Mapped[object] = mapped_column(String(20), nullable=True)
    section: Mapped[object] = mapped_column(String(20), nullable=True)
    class_id: Mapped[object] = mapped_column(
        BigInteger,
        ForeignKey("classes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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
        return f"<Room(id={self.id}, room_no='{self.room_no}', class_id={self.class_id})>"
