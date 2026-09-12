"""
Purpose: Setup Configuration Service
Author: Smart Timetable Backend Team
Module Description: Normalizes the raw Setup configuration document (stored as
JSONB and produced by the frontend with camelCase keys) into a canonical
snake_case structure the scheduler, exports and APIs can consume. Missing or
malformed values fall back to sensible defaults so the app keeps working even
before the user saves a Setup.

NEW DATA MODEL:
- break_after: list[int] - teaching period numbers AFTER which break occurs
- lunch_after: int | None - teaching period number AFTER which lunch occurs
- number_of_periods: int - TEACHING periods only (breaks/lunch don't count)

Old model (for migration):
- break_periods: list[int] - period numbers treated as breaks
- lunch_break_period: int | None - period number treated as lunch
"""

from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setup_config_model import SetupConfig
from app.utils.exceptions import SchedulingFailureError

DEFAULT_WORKING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
DEFAULT_COLLEGE_START = "09:00"
DEFAULT_COLLEGE_END = "16:00"
DEFAULT_PERIOD_DURATION = 50
DEFAULT_BREAK_TIME = 10
DEFAULT_LUNCH_TIME = 40
DEFAULT_NUMBER_OF_PERIODS = 9


def _time_to_minutes(value: str) -> Optional[int]:
    """Convert 'HH:MM' to minutes since midnight, or None when invalid."""
    if not value or not isinstance(value, str):
        return None
    parts = value.split(":")
    if len(parts) != 2:
        return None
    try:
        hours = int(parts[0])
        minutes = int(parts[1])
    except (TypeError, ValueError):
        return None
    if hours > 23 or minutes > 59:
        return None
    return hours * 60 + minutes


def _minutes_to_time(minutes: int) -> str:
    minutes = ((int(minutes) % 1440) + 1440) % 1440
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"


def _add_minutes(time_str: str, minutes: int) -> str:
    base = _time_to_minutes(time_str)
    if base is None:
        return time_str
    return _minutes_to_time(base + minutes)


def _is_valid_time(value: Any) -> bool:
    return isinstance(value, str) and _time_to_minutes(value) is not None


def _get(obj: Dict[str, Any], *keys: str, default: Any = None) -> Any:
    """Read a key tolerating both snake_case and camelCase spellings."""
    for key in keys:
        if key in obj and obj[key] is not None:
            return obj[key]
    return default


def build_default_config() -> Dict[str, Any]:
    """
    Return the canonical default configuration, mirroring the frontend
    buildDefaultConfig defaults.
    """
    periods = derive_periods(
        DEFAULT_COLLEGE_START,
        DEFAULT_PERIOD_DURATION,
        DEFAULT_NUMBER_OF_PERIODS,
        break_after=[3],
        lunch_after=6,
        break_time=DEFAULT_BREAK_TIME,
        lunch_time=DEFAULT_LUNCH_TIME,
    )
    return {
        "working_days": list(DEFAULT_WORKING_DAYS),
        "number_of_periods": DEFAULT_NUMBER_OF_PERIODS,
        "college_start_time": DEFAULT_COLLEGE_START,
        "college_end_time": DEFAULT_COLLEGE_END,
        "period_duration": DEFAULT_PERIOD_DURATION,
        "break_time": DEFAULT_BREAK_TIME,
        "lunch_time": DEFAULT_LUNCH_TIME,
        "break_after": [3],
        "lunch_after": 6,
        "periods": periods,
    }


def derive_periods(
    start_time: str,
    duration: int,
    count: int,
    break_after: List[int] = None,
    lunch_after: Optional[int] = None,
    break_time: int = 0,
    lunch_time: int = 0,
) -> List[Dict[str, Any]]:
    """
    Build a contiguous timeline of periods starting at `start_time`.

    NEW MODEL: count = number of TEACHING periods only.
    break_after = list of teaching period numbers AFTER which break occurs.
    lunch_after = teaching period number AFTER which lunch occurs.
    Break/lunch are intervals BETWEEN teaching periods, not periods themselves.

    Example: 8 teaching periods, break_after=[2], lunch_after=5
    Timeline: 1, 2, BREAK, 3, 4, 5, LUNCH, 6, 7, 8
    """
    break_after = break_after or []
    break_set = set(break_after)
    periods = []
    start = start_time

    for i in range(1, count + 1):
        # Teaching period
        end = _add_minutes(start, duration)
        periods.append(
            {
                "period_number": i,
                "start_time": start,
                "end_time": end,
                "total_minutes": max(_time_to_minutes(end) - _time_to_minutes(start), 0),
                "is_teaching": True,
                "is_break": False,
                "is_lunch": False,
            }
        )
        start = end

        # Break interval AFTER this teaching period
        if i in break_set:
            break_end = _add_minutes(start, break_time)
            periods.append(
                {
                    "period_number": i,
                    "start_time": start,
                    "end_time": break_end,
                    "total_minutes": max(_time_to_minutes(break_end) - _time_to_minutes(start), 0),
                    "is_teaching": False,
                    "is_break": True,
                    "is_lunch": False,
                }
            )
            start = break_end

        # Lunch interval AFTER this teaching period
        if lunch_after is not None and i == lunch_after:
            lunch_end = _add_minutes(start, lunch_time)
            periods.append(
                {
                    "period_number": i,
                    "start_time": start,
                    "end_time": lunch_end,
                    "total_minutes": max(_time_to_minutes(lunch_end) - _time_to_minutes(start), 0),
                    "is_teaching": False,
                    "is_break": False,
                    "is_lunch": True,
                }
            )
            start = lunch_end

    return periods


def normalize_config(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Sanitize an untrusted config document (frontend camelCase or backend
    snake_case) into the canonical snake_case structure used everywhere in the
    backend. Never raises for malformed input; defaults are applied instead.

    Supports migration from old model (break_periods, lunch_break_period)
    to new model (break_after, lunch_after).
    """
    if not raw or not isinstance(raw, dict):
        return build_default_config()

    number_of_periods = _get(raw, "number_of_periods", "numberOfPeriods", default=DEFAULT_NUMBER_OF_PERIODS)
    try:
        number_of_periods = int(number_of_periods)
    except (TypeError, ValueError):
        number_of_periods = DEFAULT_NUMBER_OF_PERIODS
    number_of_periods = max(1, min(number_of_periods, 15))

    working_days = _get(raw, "working_days", "workingDays", default=[])
    if not isinstance(working_days, list) or not working_days:
        working_days = list(DEFAULT_WORKING_DAYS)
    else:
        working_days = [d for d in working_days if d in DEFAULT_WORKING_DAYS]
        if not working_days:
            working_days = list(DEFAULT_WORKING_DAYS)

    def _clamp(value, default, minimum, maximum):
        try:
            return max(minimum, min(int(value), maximum))
        except (TypeError, ValueError):
            return default

    period_duration = _clamp(
        _get(raw, "period_duration", "periodDuration"), DEFAULT_PERIOD_DURATION, 1, 180
    )
    break_time = _clamp(_get(raw, "break_time", "breakTime"), DEFAULT_BREAK_TIME, 1, 120)
    lunch_time = _clamp(_get(raw, "lunch_time", "lunchTime"), DEFAULT_LUNCH_TIME, 1, 120)
    college_start_time = _get(raw, "college_start_time", "collegeStartTime", default=DEFAULT_COLLEGE_START)
    if not _is_valid_time(college_start_time):
        college_start_time = DEFAULT_COLLEGE_START
    college_end_time = _get(raw, "college_end_time", "collegeEndTime", default=DEFAULT_COLLEGE_END)
    if not _is_valid_time(college_end_time):
        college_end_time = DEFAULT_COLLEGE_END

    # --- Migration: break_after / break_periods ---
    break_after_raw = _get(raw, "break_after", "breakAfter")
    break_after = []
    if isinstance(break_after_raw, list):
        for p in break_after_raw:
            try:
                p_int = int(p)
            except (TypeError, ValueError):
                continue
            if 1 <= p_int < number_of_periods and p_int not in break_after:
                break_after.append(p_int)
        break_after.sort()
    else:
        # Try old model: break_periods
        break_periods_raw = _get(raw, "break_periods", "breakPeriods", default=[])
        if isinstance(break_periods_raw, list):
            for p in break_periods_raw:
                try:
                    p_int = int(p)
                except (TypeError, ValueError):
                    continue
                # Old model: break_period 3 meant "period 3 IS a break"
                # New model: break_after 2 means "break AFTER period 2"
                converted = p_int - 1
                if 1 <= converted < number_of_periods and converted not in break_after:
                    break_after.append(converted)
            break_after.sort()

    # --- Migration: lunch_after / lunch_break_period ---
    lunch_after_raw = _get(raw, "lunch_after", "lunchAfter")
    lunch_after = None
    if lunch_after_raw is not None:
        try:
            lunch_candidate = int(lunch_after_raw)
        except (TypeError, ValueError):
            lunch_candidate = None
        if lunch_candidate is not None and 1 <= lunch_candidate < number_of_periods:
            lunch_after = lunch_candidate
    else:
        # Try old model: lunch_break_period
        lunch_raw = _get(raw, "lunch_break_period", "lunchBreakPeriod")
        if lunch_raw is not None:
            try:
                lunch_candidate = int(lunch_raw) - 1
            except (TypeError, ValueError):
                lunch_candidate = None
            if lunch_candidate is not None and 1 <= lunch_candidate < number_of_periods:
                lunch_after = lunch_candidate

    stored_periods = _get(raw, "periods", default=None)
    periods = None
    if isinstance(stored_periods, list) and len(stored_periods) > 0:
        built = []
        for index, p in enumerate(stored_periods):
            if not isinstance(p, dict):
                built = None
                break
            start = p.get("start_time") or p.get("startTime")
            end = p.get("end_time") or p.get("endTime")
            if not _is_valid_time(start) or not _is_valid_time(end):
                built = None
                break
            built.append(
                {
                    "period_number": p.get("period_number") or p.get("periodNumber") or (index + 1),
                    "start_time": start,
                    "end_time": end,
                    "total_minutes": max(_time_to_minutes(end) - _time_to_minutes(start), 0),
                    "is_teaching": p.get("is_teaching", p.get("isTeaching", True)),
                    "is_break": p.get("is_break", p.get("isBreak", False)),
                    "is_lunch": p.get("is_lunch", p.get("isLunch", False)),
                }
            )
        periods = built

    if not periods:
        periods = derive_periods(
            college_start_time,
            period_duration,
            number_of_periods,
            break_after=break_after,
            lunch_after=lunch_after,
            break_time=break_time,
            lunch_time=lunch_time,
        )

    return {
        "working_days": working_days,
        "number_of_periods": number_of_periods,
        "college_start_time": college_start_time,
        "college_end_time": college_end_time,
        "period_duration": period_duration,
        "break_time": break_time,
        "lunch_time": lunch_time,
        "break_after": break_after,
        "lunch_after": lunch_after,
        "periods": periods,
    }


def instructional_period_numbers(config: Dict[str, Any]) -> List[int]:
    """
    Period numbers that are actual teaching slots. With the new model,
    we filter the periods list for is_teaching entries.
    """
    return [
        p["period_number"]
        for p in config.get("periods", [])
        if p.get("is_teaching", True)
    ]


async def load_config(db: AsyncSession, user_id: Optional[str]) -> Dict[str, Any]:
    """
    Load the user's Setup configuration from the database, falling back to
    defaults when absent. The user_id may be None (system/legacy callers); in
    that case defaults are returned.
    """
    if not user_id:
        return build_default_config()

    result = await db.execute(select(SetupConfig).where(SetupConfig.user_id == user_id))
    row = result.scalars().first()
    if row is None:
        return build_default_config()
    return normalize_config(row.config)


def validate_config_for_generation(config: Dict[str, Any]) -> None:
    """
    Raise a clear scheduling error when the Setup configuration cannot drive
    generation (missing working days or no usable teaching periods).
    """
    if not config.get("working_days"):
        raise SchedulingFailureError(
            "Please complete Setup configuration before generating the timetable."
        )
    if not config.get("periods") or not instructional_period_numbers(config):
        raise SchedulingFailureError(
            "Please complete Setup configuration before generating the timetable."
        )
