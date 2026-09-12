"""
Purpose: Greedy Scheduling Algorithm
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Implements greedy initial scheduling logic prioritizing Labs, Electives, and high-hour Theory classes.
"""

from typing import List, Dict, Any, Tuple
import random
from app.utils.logger import get_logger
from app.services.conflict_checker import ConflictChecker
from app.services.lab_allocator import LabAllocator
from app.services.workload_manager import WorkloadManager

logger = get_logger(__name__)


class GreedyScheduler:
    """
    Performs initial slot allocations based on constraint-density heuristics.
    """

    @classmethod
    def schedule(
        cls,
        classes: List[str],
        subjects: List[Dict[str, Any]],
        faculty_avail_map: Dict[str, str],
        constraints: Dict[str, Any]
    ) -> Tuple[Dict[str, Dict[str, Dict[int, Dict[str, Any]]]], Dict[str, Dict[str, Dict[int, str]]], List[Dict[str, Any]]]:
        """
        Runs the greedy scheduling algorithm.

        Args:
            classes (List[str]): List of class names.
            subjects (List[Dict]): List of subjects.
            faculty_avail_map (Dict): Faculty availability.
            constraints (Dict): Global constraints.

        Returns:
            Tuple: (schedule, faculty_schedule, unallocated_subjects)
        """
        logger.info("Initializing Greedy scheduling pass.")
        working_days = [d.strip() for d in str(constraints.get("working_days", "Monday,Tuesday,Wednesday,Thursday,Friday")).split(",") if d.strip()]
        periods_per_day = int(constraints.get("periods_per_day", 7))
        lunch_break = int(constraints.get("lunch_break", 4))
        break_period = int(constraints.get("break_period", 2))

        # Initialize schedules
        schedule = {}
        for c in classes:
            schedule[c] = {}
            for d in working_days:
                schedule[c][d] = {}
                for p in range(1, periods_per_day + 1):
                    schedule[c][d][p] = None

        faculty_schedule = {}
        for f in faculty_avail_map.keys():
            faculty_schedule[f] = {}
            for d in working_days:
                faculty_schedule[f][d] = {}

        # Track remaining hours for each subject
        remaining_subjects = []
        for s in subjects:
            remaining_subjects.append({
                "id": s["id"],
                "class_name": s["Class"],
                "subject_name": s["Subject"],
                "faculty_name": s["Faculty"],
                "hours_per_week": s["HoursPerWeek"],
                "subject_type": s["SubjectType"],
                "remaining_hours": s["HoursPerWeek"]
            })

        # 1. Allocate Labs first
        labs = [s for s in remaining_subjects if s["subject_type"] == "Lab"]
        labs.sort(key=lambda x: x["remaining_hours"], reverse=True)

        for lab in labs:
            cls._allocate_lab(lab, schedule, faculty_schedule, constraints, faculty_avail_map)

        # 2. Allocate Electives next
        electives = [s for s in remaining_subjects if s["subject_type"] == "Elective" and s["remaining_hours"] > 0]
        cls._allocate_electives(electives, schedule, faculty_schedule, constraints, faculty_avail_map)

        # 3. Allocate Theory subjects last
        theory = [s for s in remaining_subjects if s["subject_type"] == "Theory" and s["remaining_hours"] > 0]
        theory.sort(key=lambda x: x["remaining_hours"], reverse=True)

        for t in theory:
            cls._allocate_theory(t, schedule, faculty_schedule, constraints, faculty_avail_map)

        # Collect unallocated subjects
        unallocated = [s for s in remaining_subjects if s["remaining_hours"] > 0]
        logger.info(f"Greedy scheduling finished. Unallocated subjects count: {len(unallocated)}")

        return schedule, faculty_schedule, unallocated

    @classmethod
    def _allocate_lab(
        cls,
        lab: Dict[str, Any],
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        faculty_schedule: Dict[str, Dict[str, Dict[int, str]]],
        constraints: Dict[str, Any],
        faculty_avail_map: Dict[str, str]
    ) -> None:
        class_name = lab["class_name"]
        subj_name = lab["subject_name"]
        fac_name = lab["faculty_name"]
        hours = lab["remaining_hours"]

        duration = hours
        options = LabAllocator.find_consecutive_slots(
            schedule, faculty_schedule, class_name, subj_name, fac_name, duration, constraints, faculty_avail_map
        )

        if options:
            day, periods = random.choice(options)
            for p in periods:
                schedule[class_name][day][p] = {
                    "id": lab["id"],
                    "subject": subj_name,
                    "faculty": fac_name,
                    "type": "Lab"
                }
                faculty_schedule[fac_name][day][p] = class_name
            lab["remaining_hours"] = 0
            logger.debug(f"Allocated Lab {subj_name} for {class_name} on {day} at periods {periods}")
        else:
            if duration > 2:
                for chunk in [2, duration - 2]:
                    if chunk < 2:
                        continue
                    opts = LabAllocator.find_consecutive_slots(
                        schedule, faculty_schedule, class_name, subj_name, fac_name, chunk, constraints, faculty_avail_map
                    )
                    if opts:
                        day, periods = random.choice(opts)
                        for p in periods:
                            schedule[class_name][day][p] = {
                                "id": lab["id"],
                                "subject": subj_name,
                                "faculty": fac_name,
                                "type": "Lab"
                            }
                            faculty_schedule[fac_name][day][p] = class_name
                        lab["remaining_hours"] -= chunk
                        logger.debug(f"Allocated partial Lab {subj_name} (size {chunk}) for {class_name} on {day} at periods {periods}")
                        if lab["remaining_hours"] <= 0:
                            break

    @classmethod
    def _allocate_electives(
        cls,
        electives: List[Dict[str, Any]],
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        faculty_schedule: Dict[str, Dict[str, Dict[int, str]]],
        constraints: Dict[str, Any],
        faculty_avail_map: Dict[str, str]
    ) -> None:
        groups = {}
        for s in electives:
            name = s["subject_name"]
            if name not in groups:
                groups[name] = []
            groups[name].append(s)

        working_days = [d.strip() for d in str(constraints.get("working_days", "Monday,Tuesday,Wednesday,Thursday,Friday")).split(",") if d.strip()]
        periods_per_day = int(constraints.get("periods_per_day", 7))
        lunch_break = int(constraints.get("lunch_break", 4))
        break_period = int(constraints.get("break_period", 2))

        for group_name, s_list in groups.items():
            max_hours = max(s["remaining_hours"] for s in s_list)

            slots_found = 0
            shuffled_slots = []
            for day in working_days:
                for period in range(1, periods_per_day + 1):
                    if period == lunch_break or period == break_period:
                        continue
                    shuffled_slots.append((day, period))
            random.shuffle(shuffled_slots)

            for day, period in shuffled_slots:
                if slots_found >= max_hours:
                    break

                can_schedule = True
                faculties_in_slot = {}

                for s in s_list:
                    c_name = s["class_name"]
                    f_name = s["faculty_name"]

                    if schedule[c_name][day][period] is not None:
                        can_schedule = False
                        break

                    avail_str = faculty_avail_map.get(f_name, "All")
                    if not ConflictChecker.is_faculty_available_on_day(avail_str, day):
                        can_schedule = False
                        break

                    if faculty_schedule[f_name][day].get(period) is not None:
                        busy_class = faculty_schedule[f_name][day][period]
                        is_part_of_group = any(s_grp["class_name"] == busy_class for s_grp in s_list)
                        if not is_part_of_group:
                            can_schedule = False
                            break
                    
                    faculties_in_slot[f_name] = c_name

                if can_schedule:
                    for s in s_list:
                        if s["remaining_hours"] > 0:
                            c_name = s["class_name"]
                            f_name = s["faculty_name"]
                            
                            schedule[c_name][day][period] = {
                                "id": s["id"],
                                "subject": group_name,
                                "faculty": f_name,
                                "type": "Elective"
                            }
                            faculty_schedule[f_name][day][period] = c_name
                            s["remaining_hours"] -= 1

                    slots_found += 1
                    logger.debug(f"Allocated Elective {group_name} in parallel on {day} at period {period}")

    @classmethod
    def _allocate_theory(
        cls,
        t: Dict[str, Any],
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        faculty_schedule: Dict[str, Dict[str, Dict[int, str]]],
        constraints: Dict[str, Any],
        faculty_avail_map: Dict[str, str]
    ) -> None:
        class_name = t["class_name"]
        subj_name = t["subject_name"]
        fac_name = t["faculty_name"]

        working_days = [d.strip() for d in str(constraints.get("working_days", "Monday,Tuesday,Wednesday,Thursday,Friday")).split(",") if d.strip()]
        periods_per_day = int(constraints.get("periods_per_day", 7))
        lunch_break = int(constraints.get("lunch_break", 4))
        break_period = int(constraints.get("break_period", 2))

        all_slots = []
        for day in working_days:
            for p in range(1, periods_per_day + 1):
                if p != lunch_break and p != break_period:
                    all_slots.append((day, p))

        random.shuffle(all_slots)

        for day, p in all_slots:
            if t["remaining_hours"] <= 0:
                return

            if WorkloadManager.satisfies_distribution_limit(schedule, class_name, day, subj_name, "Theory"):
                if ConflictChecker.is_valid_assignment(
                    schedule, faculty_schedule, class_name, subj_name, fac_name, day, p, constraints, faculty_avail_map
                ):
                    schedule[class_name][day][p] = {
                        "id": t["id"],
                        "subject": subj_name,
                        "faculty": fac_name,
                        "type": "Theory"
                    }
                    faculty_schedule[fac_name][day][p] = class_name
                    t["remaining_hours"] -= 1

        if t["remaining_hours"] > 0:
            for day, p in all_slots:
                if t["remaining_hours"] <= 0:
                    return

                if ConflictChecker.is_valid_assignment(
                    schedule, faculty_schedule, class_name, subj_name, fac_name, day, p, constraints, faculty_avail_map
                ):
                    schedule[class_name][day][p] = {
                        "id": t["id"],
                        "subject": subj_name,
                        "faculty": fac_name,
                        "type": "Theory"
                    }
                    faculty_schedule[fac_name][day][p] = class_name
                    t["remaining_hours"] -= 1
