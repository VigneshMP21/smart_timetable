"""
Purpose: Setup Configuration SQLAlchemy Database Model
Author: Smart Timetable Backend Team
Module Description: Implements the database schema for storing a user's
timetable Setup configuration (working days, number of periods, period
timings, break and lunch periods) as a JSONB document.

Database interaction:
  - Table  : setup_config
  - Columns: id, user_id, config (jsonb), created_at, updated_at
  - Keys   : user_id is unique (one configuration per user). user_id is a FK
             to profiles.id (the Supabase user's UUID) and cascades on delete.
  - RLS    : enabled with select/insert/update policies scoped to the owner.
"""

import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, UniqueConstraint, Uuid, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SetupConfig(Base):
    """
    SQLAlchemy model representing a user's Setup (timetable configuration).
    """

    __tablename__ = "setup_config"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_setup_config_user_id"),
        Index("idx_setup_config_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[object] = mapped_column(
        Uuid, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    config: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
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
        return f"<SetupConfig(id={self.id}, user_id={self.user_id})>"
