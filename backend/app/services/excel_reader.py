"""
Purpose: Excel Reader Service
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Reads Excel sheets using Pandas, parses them into standardized dictionary formats.
"""

from pathlib import Path
from typing import Dict, Any, List
import pandas as pd

from app.utils.logger import get_logger
from app.utils.exceptions import ExcelValidationError

logger = get_logger(__name__)


class ExcelReader:
    """
    Service class responsible for reading and parsing institutional scheduling Excel files.
    """

    @staticmethod
    def read_excel_file(file_path: Path) -> Dict[str, Any]:
        """
        Reads an Excel workbook and parses its 4 mandatory sheets:
        Classes, Subjects, Faculty, and Constraints.

        Args:
            file_path (Path): Path to the uploaded Excel file.

        Returns:
            Dict[str, Any]: Structured dictionary representing raw sheets data.

        Raises:
            ExcelValidationError: If the file structure, sheet names, or critical formats are invalid.
        """
        logger.info(f"Starting Excel parsing for file: {file_path}")

        if not file_path.exists():
            raise ExcelValidationError("File does not exist.", [{"error": "File missing on disk."}])

        try:
            excel_file = pd.ExcelFile(file_path)
        except Exception as e:
            logger.error(f"Failed to open Excel file: {str(e)}")
            raise ExcelValidationError(f"Invalid Excel file format: {str(e)}", [{"error": "Invalid format or corrupt file."}])

        sheet_names = excel_file.sheet_names
        logger.debug(f"Sheets found in Excel: {sheet_names}")

        # Check for sheet matches (case insensitive)
        expected_sheets = ["Classes", "Subjects", "Faculty", "Constraints"]
        sheet_mapping = {}

        for expected in expected_sheets:
            match = [s for s in sheet_names if s.strip().lower() == expected.lower()]
            if not match:
                logger.error(f"Missing sheet in uploaded Excel: {expected}")
                raise ExcelValidationError(
                    f"Missing mandatory sheet: {expected}",
                    [{"error": f"The workbook must contain a sheet named '{expected}'."}]
                )
            sheet_mapping[expected] = match[0]

        parsed_data = {}

        # 1. Parse Classes
        try:
            classes_df = excel_file.parse(sheet_mapping["Classes"])
            classes_df.columns = [str(c).strip() for c in classes_df.columns]
            
            class_col = "Class"
            if class_col not in classes_df.columns:
                if len(classes_df.columns) > 0:
                    class_col = classes_df.columns[0]
                else:
                    raise ValueError("Classes sheet is empty or has no columns.")
            
            classes_list = classes_df[class_col].dropna().astype(str).str.strip().tolist()
            classes_list = [c for c in classes_list if c]
            parsed_data["classes"] = classes_list
            logger.info(f"Parsed {len(classes_list)} classes.")
        except Exception as e:
            logger.error(f"Error parsing Classes sheet: {str(e)}")
            raise ExcelValidationError(f"Failed to parse Classes sheet: {str(e)}", [{"sheet": "Classes", "error": str(e)}])

        # 2. Parse Faculty
        try:
            faculty_df = excel_file.parse(sheet_mapping["Faculty"])
            faculty_df.columns = [str(c).strip() for c in faculty_df.columns]
            
            req_fac_cols = ["FacultyName", "Department", "Available"]
            for col in req_fac_cols:
                if col not in faculty_df.columns:
                    raise ValueError(f"Faculty sheet is missing column '{col}'. Columns present: {list(faculty_df.columns)}")
            
            faculty_list = []
            for _, row in faculty_df.iterrows():
                if pd.isna(row["FacultyName"]):
                    continue
                faculty_list.append({
                    "FacultyName": str(row["FacultyName"]).strip(),
                    "Department": str(row["Department"]).strip() if not pd.isna(row["Department"]) else "Unknown",
                    "Available": "All" if str(row["Available"]).strip().lower() in ("yes", "all") else str(row["Available"]).strip() if not pd.isna(row["Available"]) else "All"
                })
            parsed_data["faculty"] = faculty_list
            logger.info(f"Parsed {len(faculty_list)} faculty members.")
        except Exception as e:
            logger.error(f"Error parsing Faculty sheet: {str(e)}")
            raise ExcelValidationError(f"Failed to parse Faculty sheet: {str(e)}", [{"sheet": "Faculty", "error": str(e)}])

        # 3. Parse Subjects
        try:
            subjects_df = excel_file.parse(sheet_mapping["Subjects"])
            subjects_df.columns = [str(c).strip() for c in subjects_df.columns]
            
            req_subj_cols = ["Class", "Subject", "Faculty", "HoursPerWeek", "SubjectType"]
            for col in req_subj_cols:
                if col not in subjects_df.columns:
                    raise ValueError(f"Subjects sheet is missing column '{col}'. Columns present: {list(subjects_df.columns)}")
            
            subjects_list = []
            for _, row in subjects_df.iterrows():
                if pd.isna(row["Subject"]) and pd.isna(row["Class"]):
                    continue
                
                hours = row["HoursPerWeek"]
                if not pd.isna(hours):
                    try:
                        hours = int(hours)
                    except ValueError:
                        hours = str(hours)  # pass raw value to let validator show clear error
                else:
                    hours = None

                subjects_list.append({
                    "Class": str(row["Class"]).strip() if not pd.isna(row["Class"]) else None,
                    "Subject": str(row["Subject"]).strip() if not pd.isna(row["Subject"]) else None,
                    "Faculty": str(row["Faculty"]).strip() if not pd.isna(row["Faculty"]) else None,
                    "HoursPerWeek": hours,
                    "SubjectType": str(row["SubjectType"]).strip() if not pd.isna(row["SubjectType"]) else None
                })
            parsed_data["subjects"] = subjects_list
            logger.info(f"Parsed {len(subjects_list)} subjects.")
        except Exception as e:
            logger.error(f"Error parsing Subjects sheet: {str(e)}")
            raise ExcelValidationError(f"Failed to parse Subjects sheet: {str(e)}", [{"sheet": "Subjects", "error": str(e)}])

        # 4. Parse Constraints
        try:
            constraints_df = excel_file.parse(sheet_mapping["Constraints"])
            constraints_df.columns = [str(c).strip() for c in constraints_df.columns]
            
            constraints_raw = {}
            horizontal_keys = ["Working Days", "Periods Per Day", "Lunch Break", "Break Period", "Max Consecutive Classes", "Maximum Daily Hours"]
            is_horizontal = any(
                any(expected.lower() in str(col).strip().lower() for expected in ["working", "periods", "lunch", "break", "consecutive", "maximum", "daily"])
                for col in constraints_df.columns
            )
            
            if is_horizontal:
                if len(constraints_df) > 0:
                    row = constraints_df.iloc[0]
                    for key in horizontal_keys:
                        for col in constraints_df.columns:
                            if key.lower() in str(col).strip().lower() or str(col).strip().lower() in key.lower():
                                constraints_raw[key] = row[col]
                                break
            else:
                if len(constraints_df.columns) >= 2:
                    col_a = constraints_df.columns[0]
                    col_b = constraints_df.columns[1]

                    col_a_lower = str(col_a).strip().lower()
                    for key in horizontal_keys:
                        if key.lower() in col_a_lower or col_a_lower in key.lower():
                            constraints_raw[str(col_a).strip()] = col_b
                            break
                    
                    for _, row in constraints_df.iterrows():
                        key_val = str(row[col_a]).strip()
                        val_val = row[col_b]
                        constraints_raw[key_val] = val_val

            key_aliases = {
                "working_days": ["working days", "work days", "days"],
                "periods_per_day": ["periods per day", "periods/day", "periods"],
                "lunch_break": ["lunch break", "lunch period", "lunch"],
                "break_period": ["break period", "break", "recess"],
                "max_consecutive_classes": ["max consecutive classes", "consecutive classes", "max consecutive"],
                "max_daily_hours": ["maximum daily hours", "max daily hours", "daily hours", "maximum hours"]
            }

            constraints_dict = {}
            for clean_k, aliases in key_aliases.items():
                found_val = None
                for k, v in constraints_raw.items():
                    k_lower = k.strip().lower()
                    if any(alias in k_lower for alias in aliases):
                        found_val = v
                        break
                constraints_dict[clean_k] = found_val

            parsed_data["constraints"] = constraints_dict
            logger.info("Parsed Constraints successfully.")
        except Exception as e:
            logger.error(f"Error parsing Constraints sheet: {str(e)}")
            raise ExcelValidationError(f"Failed to parse Constraints sheet: {str(e)}", [{"sheet": "Constraints", "error": str(e)}])

        return parsed_data
