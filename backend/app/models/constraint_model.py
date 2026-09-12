"""
Purpose: Constraint SQLAlchemy Database Model
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Implements the database schema for global scheduling configuration parameters.
"""

from datetime import datetime
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class Constraint(Base):
    """
    SQLAlchemy model representing global scheduler rules and configurations.
    """
    __tablename__ = "constraints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Comma-separated days of week, e.g., "Monday,Tuesday,Wednesday,Thursday,Friday"
    working_days: Mapped[str] = mapped_column(String(255), nullable=False, default="Monday,Tuesday,Wednesday,Thursday,Friday")
    periods_per_day: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    lunch_break: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    break_period: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    max_consecutive_classes: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    max_daily_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=6)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<Constraint(id={self.id}, working_days='{self.working_days}', periods={self.periods_per_day})>"
