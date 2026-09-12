"""
Purpose: Export Data Loader
Author: Smart Timetable Backend Team
Module Description: Loads the config, class metadata and saved entries once
so the PDF / Excel / Word export services render exactly what is stored
(including manual edits).
"""

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.setup_config import load_config
from app.services.timetable_data import TimetableDataService


async def load_export_data(
    db: AsyncSession,
    user_id: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], Dict[str, Any]]:
    """
    Returns (class_models, config, formatted_timetable).

    The formatted timetable is the nested Class -> Day -> list of slot dicts,
    identical to what the API returns.
    """
    domain = await TimetableDataService.load_domain(db)
    config = await load_config(db, user_id)
    class_models = TimetableDataService.build_class_models(domain)
    entries = await TimetableDataService.load_saved_entries(db, user_id)
    grid = TimetableDataService.grid_from_entries(entries)
    formatted = TimetableDataService.format_timetable(class_models, config, grid)
    return class_models, config, formatted
