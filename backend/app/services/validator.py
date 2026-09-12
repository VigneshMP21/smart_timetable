"""
Purpose: Excel Validation Service
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Validates parsed Excel data against structural, logical, and relational rules.
"""

from typing import Dict, Any, List
from app.utils.logger import get_logger
from app.utils.exceptions import ExcelValidationError
from app.utils.constants import VALID_SUBJECT_TYPES, DAYS_OF_WEEK

logger = get_logger(__name__)


class ExcelValidator:
    """
    Validator engine for verifying completeness and logical correctness of uploaded Excel data.
    """

    @staticmethod
    def validate(raw_data: Dict[str, Any]) -> None:
        """
        Validates all sheets data and raises ExcelValidationError if errors are found.

        Args:
            raw_data (Dict[str, Any]): Parsed Excel data dictionary.

        Raises:
            ExcelValidationError: If any validation rule is violated.
        """
        errors = []

        # Extract parsed objects
        classes = raw_data.get("classes", [])
        faculty = raw_data.get("faculty", [])
        subjects = raw_data.get("subjects", [])
        constraints = raw_data.get("constraints", {})

        logger.info("Executing validations on parsed Excel data.")

        # 1. Validate Constraints
        working_days = []
        periods_per_day = 0
        lunch_break = 0
        break_period = 0

        # Validate working_days
        raw_working_days = constraints.get("working_days")
        if not raw_working_days:
            errors.append({"sheet": "Constraints", "error": "Working Days configuration is missing or empty."})
        else:
            days = [d.strip() for d in str(raw_working_days).split(",") if d.strip()]
            for d in days:
                match = [day for day in DAYS_OF_WEEK if day.lower() == d.lower()]
                if not match:
                    errors.append({"sheet": "Constraints", "error": f"Invalid Working Day: '{d}'."})
                else:
                    working_days.append(match[0])

        # Validate periods_per_day
        raw_periods = constraints.get("periods_per_day")
        try:
            periods_per_day = int(raw_periods)
            if periods_per_day <= 0 or periods_per_day > 12:
                errors.append({"sheet": "Constraints", "error": f"Periods Per Day must be between 1 and 12. Got: {raw_periods}."})
        except (ValueError, TypeError):
            errors.append({"sheet": "Constraints", "error": f"Periods Per Day must be a valid integer. Got: {raw_periods}."})

        # Validate breaks
        raw_lunch = constraints.get("lunch_break")
        try:
            lunch_break = int(raw_lunch)
            if lunch_break <= 0 or (periods_per_day > 0 and lunch_break > periods_per_day):
                errors.append({"sheet": "Constraints", "error": f"Lunch Break period ({raw_lunch}) must be between 1 and periods_per_day ({periods_per_day})."})
        except (ValueError, TypeError):
            errors.append({"sheet": "Constraints", "error": f"Lunch Break period must be a valid integer. Got: {raw_lunch}."})

        raw_break = constraints.get("break_period")
        try:
            break_period = int(raw_break)
            if break_period <= 0 or (periods_per_day > 0 and break_period > periods_per_day):
                errors.append({"sheet": "Constraints", "error": f"Break period ({raw_break}) must be between 1 and periods_per_day ({periods_per_day})."})
        except (ValueError, TypeError):
            errors.append({"sheet": "Constraints", "error": f"Break period must be a valid integer. Got: {raw_break}."})

        # Validate max consecutive classes and max daily hours
        raw_consecutive = constraints.get("max_consecutive_classes")
        try:
            consecutive = int(raw_consecutive)
            if consecutive <= 0 or consecutive > 8:
                errors.append({"sheet": "Constraints", "error": f"Max Consecutive Classes must be positive and reasonable. Got: {raw_consecutive}."})
        except (ValueError, TypeError):
            errors.append({"sheet": "Constraints", "error": f"Max Consecutive Classes must be an integer. Got: {raw_consecutive}."})

        raw_max_hours = constraints.get("max_daily_hours")
        try:
            max_hours = int(raw_max_hours)
            if max_hours <= 0 or max_hours > 12:
                errors.append({"sheet": "Constraints", "error": f"Maximum Daily Hours must be between 1 and 12. Got: {raw_max_hours}."})
        except (ValueError, TypeError):
            errors.append({"sheet": "Constraints", "error": f"Maximum Daily Hours must be an integer. Got: {raw_max_hours}."})

        # Calculate total available teaching periods in a week per class
        # (Periods per day - Lunch - Break) * Working Days
        empty_periods_per_day = 0
        if lunch_break > 0:
            empty_periods_per_day += 1
        if break_period > 0 and break_period != lunch_break:
            empty_periods_per_day += 1
            
        teaching_periods_per_day = max(0, periods_per_day - empty_periods_per_day)
        total_slots_per_week = teaching_periods_per_day * len(working_days)

        # 2. Validate Classes
        if not classes:
            errors.append({"sheet": "Classes", "error": "Classes list is empty. Add at least one Class name."})
        
        duplicate_classes = [c for c in classes if classes.count(c) > 1]
        unique_duplicate_classes = list(set(duplicate_classes))
        if unique_duplicate_classes:
            errors.append({"sheet": "Classes", "error": f"Duplicate classes found: {unique_duplicate_classes}."})

        # 3. Validate Faculty
        if not faculty:
            errors.append({"sheet": "Faculty", "error": "Faculty list is empty."})
        
        faculty_names = [f["FacultyName"] for f in faculty]
        duplicate_faculties = [name for name in faculty_names if faculty_names.count(name) > 1]
        unique_duplicate_faculties = list(set(duplicate_faculties))
        if unique_duplicate_faculties:
            errors.append({"sheet": "Faculty", "error": f"Duplicate faculty names found: {unique_duplicate_faculties}."})

        faculty_availability_map = {}
        for idx, f in enumerate(faculty, start=2):
            name = f["FacultyName"]
            avail_str = f["Available"]
            department = f["Department"]

            if not name:
                errors.append({"sheet": "Faculty", "row": idx, "error": "Faculty name is empty."})
                continue

            if not department or department == "Unknown":
                errors.append({"sheet": "Faculty", "row": idx, "name": name, "error": "Department is empty."})

            # Check availability days
            if avail_str.lower() not in ("all", "yes"):
                avail_days = [d.strip() for d in avail_str.split(",") if d.strip()]
                for ad in avail_days:
                    day_match = [day for day in DAYS_OF_WEEK if day.lower() == ad.lower()]
                    if not day_match:
                        errors.append({"sheet": "Faculty", "row": idx, "name": name, "error": f"Invalid day '{ad}' in Available list."})
                    elif day_match[0] not in working_days:
                        errors.append({
                            "sheet": "Faculty", 
                            "row": idx, 
                            "name": name, 
                            "error": f"Faculty availability day '{day_match[0]}' is not configured as a working day in constraints."
                        })
            faculty_availability_map[name] = avail_str

        # 4. Validate Subjects
        if not subjects:
            errors.append({"sheet": "Subjects", "error": "Subjects list is empty."})

        class_subjects_hours = {}
        class_subjects_names = {}

        for idx, s in enumerate(subjects, start=2):
            s_class = s.get("Class")
            s_name = s.get("Subject")
            s_faculty = s.get("Faculty")
            s_hours = s.get("HoursPerWeek")
            s_type = s.get("SubjectType")

            # Check for empty cells
            if not s_class:
                errors.append({"sheet": "Subjects", "row": idx, "error": "Class field is empty."})
            if not s_name:
                errors.append({"sheet": "Subjects", "row": idx, "error": "Subject name is empty."})
            if not s_faculty:
                errors.append({"sheet": "Subjects", "row": idx, "error": "Faculty name is empty."})
            if s_hours is None:
                errors.append({"sheet": "Subjects", "row": idx, "error": "HoursPerWeek is empty."})
            if not s_type:
                errors.append({"sheet": "Subjects", "row": idx, "error": "SubjectType is empty."})

            if not s_class or not s_name or not s_faculty or s_hours is None or not s_type:
                continue

            # Check class exists
            if s_class not in classes:
                errors.append({"sheet": "Subjects", "row": idx, "error": f"Class '{s_class}' is not declared in the Classes sheet."})

            # Check faculty exists
            if s_faculty not in faculty_availability_map:
                errors.append({"sheet": "Subjects", "row": idx, "error": f"Faculty '{s_faculty}' is not declared in the Faculty sheet."})

            # Check subject type validity
            if s_type not in VALID_SUBJECT_TYPES:
                errors.append({"sheet": "Subjects", "row": idx, "error": f"SubjectType '{s_type}' is invalid. Must be one of {VALID_SUBJECT_TYPES}."})

            # Check hours validity
            if not isinstance(s_hours, int):
                errors.append({"sheet": "Subjects", "row": idx, "error": f"HoursPerWeek must be a valid integer. Got: '{s_hours}'."})
            else:
                if s_hours <= 0:
                    errors.append({"sheet": "Subjects", "row": idx, "error": f"HoursPerWeek must be a positive integer. Got: {s_hours}."})
                if s_type == "Lab" and s_hours < 2:
                    errors.append({"sheet": "Subjects", "row": idx, "error": f"Lab subject '{s_name}' should have at least 2 hours to form a consecutive block."})

                class_subjects_hours[s_class] = class_subjects_hours.get(s_class, 0) + s_hours

            # Track duplicates per class
            if s_class not in class_subjects_names:
                class_subjects_names[s_class] = []
            
            if s_name in class_subjects_names[s_class]:
                errors.append({"sheet": "Subjects", "row": idx, "error": f"Duplicate subject '{s_name}' declared for Class '{s_class}'."})
            else:
                class_subjects_names[s_class].append(s_name)

        # Check if total class load exceeds slot limit
        for cls, total_hours in class_subjects_hours.items():
            if total_slots_per_week > 0 and total_hours > total_slots_per_week:
                errors.append({
                    "sheet": "Subjects",
                    "error": f"Class '{cls}' has a total of {total_hours} hours per week configured, "
                             f"but there are only {total_slots_per_week} available slots in the working week."
                })

        if errors:
            logger.error(f"Excel validation failed with {len(errors)} errors.")
            raise ExcelValidationError("Validation failed for the uploaded Excel.", errors)

        logger.info("Excel validation completed successfully with zero errors.")
