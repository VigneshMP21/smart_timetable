"""
Purpose: Timetable Optimizer Service
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Optimizes the generated timetable by reducing gaps (student idle periods) and balancing distribution.
"""

from typing import Dict, Any, List
from app.utils.logger import get_logger
from app.services.conflict_checker import ConflictChecker

logger = get_logger(__name__)


class TimetableOptimizer:
    """
    Post-processes the generated timetable to improve quality metrics.
    """

    @classmethod
    def optimize(
        cls,
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        faculty_schedule: Dict[str, Dict[str, Dict[int, str]]],
        constraints: Dict[str, Any],
        faculty_avail_map: Dict[str, str]
    ) -> None:
        """
        Runs multiple optimization passes:
        1. Compresses schedules (shifts lectures to remove gaps).
        2. Balances faculty workloads if possible.

        Args:
            schedule (Dict): Class timetable map.
            faculty_schedule (Dict): Faculty schedule tracker.
            constraints (Dict): Global constraints.
            faculty_avail_map (Dict): Faculty availability mapping.
        """
        logger.info("Starting timetable optimization passes.")
        cls._remove_gaps(schedule, faculty_schedule, constraints, faculty_avail_map)
        logger.info("Timetable optimization passes completed.")

    @classmethod
    def _remove_gaps(
        cls,
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        faculty_schedule: Dict[str, Dict[str, Dict[int, str]]],
        constraints: Dict[str, Any],
        faculty_avail_map: Dict[str, str]
    ) -> None:
        """
        Attempts to move lectures to earlier empty slots to eliminate idle gaps for students.
        """
        working_days = [d.strip() for d in str(constraints.get("working_days", "Monday,Tuesday,Wednesday,Thursday,Friday")).split(",") if d.strip()]
        periods_per_day = int(constraints.get("periods_per_day", 7))
        lunch_break = int(constraints.get("lunch_break", 4))
        break_period = int(constraints.get("break_period", 2))

        for class_name, days_data in schedule.items():
            for day in working_days:
                made_shift = True
                while made_shift:
                    made_shift = False
                    for period in range(1, periods_per_day + 1):
                        if period == lunch_break or period == break_period:
                            continue

                        # If this period is empty, let's see if there is a lecture scheduled LATER in the day
                        if days_data[day][period] is None:
                            for target_p in range(period + 1, periods_per_day + 1):
                                if target_p == lunch_break or target_p == break_period:
                                    continue
                                
                                lecture = days_data[day][target_p]
                                if lecture is not None:
                                    subj_name = lecture["subject"]
                                    fac_name = lecture["faculty"]
                                    
                                    # Temporarily remove from target_p to check validity
                                    days_data[day][target_p] = None
                                    if target_p in faculty_schedule[fac_name][day]:
                                        del faculty_schedule[fac_name][day][target_p]
                                    
                                    if ConflictChecker.is_valid_assignment(
                                        schedule, faculty_schedule, class_name, subj_name, fac_name,
                                        day, period, constraints, faculty_avail_map, is_lab=(lecture["type"] == "Lab")
                                    ):
                                        days_data[day][period] = lecture
                                        faculty_schedule[fac_name][day][period] = class_name
                                        made_shift = True
                                        logger.debug(f"Shifted {subj_name} for {class_name} on {day} from period {target_p} to {period} to remove gap.")
                                        break
                                    else:
                                        # Rollback
                                        days_data[day][target_p] = lecture
                                        faculty_schedule[fac_name][day][target_p] = class_name
                            
                            if made_shift:
                                break
