"""
Purpose: Sample Excel Workbook Generator for Testing
Author: Scheduler Backend Team
Created Date: 2026-08-03
Description: Creates a valid, styled template Excel sheet named 'sample_timetable.xlsx' 
             that conforms to the scheduler validation engine requirements.
"""

import pandas as pd
from pathlib import Path


def generate_sample_excel():
    output_dir = Path("C:/Users/sivak/OneDrive/Desktop/Automatic-TimeTable-Scheduler/sample_excel")
    output_dir.mkdir(parents=True, exist_ok=True)
    file_path = output_dir / "sample_timetable.xlsx"

    print(f"Generating sample Excel file at: {file_path}")

    # 1. Classes sheet
    classes_df = pd.DataFrame({
        "Class": ["CSE-A", "CSE-B", "CAI-A", "CSM-A"]
    })

    # 2. Subjects sheet
    subjects_df = pd.DataFrame([
        # CSE-A
        {"Class": "CSE-A", "Subject": "Mathematics", "Faculty": "Ravi", "HoursPerWeek": 4, "SubjectType": "Theory"},
        {"Class": "CSE-A", "Subject": "Operating Systems", "Faculty": "Priya", "HoursPerWeek": 3, "SubjectType": "Theory"},
        {"Class": "CSE-A", "Subject": "Database Systems", "Faculty": "Amit", "HoursPerWeek": 3, "SubjectType": "Theory"},
        {"Class": "CSE-A", "Subject": "DBMS Lab", "Faculty": "Amit", "HoursPerWeek": 3, "SubjectType": "Lab"},
        {"Class": "CSE-A", "Subject": "Python Elective", "Faculty": "Ravi", "HoursPerWeek": 3, "SubjectType": "Elective"},

        # CSE-B
        {"Class": "CSE-B", "Subject": "Mathematics", "Faculty": "Ravi", "HoursPerWeek": 4, "SubjectType": "Theory"},
        {"Class": "CSE-B", "Subject": "Operating Systems", "Faculty": "Priya", "HoursPerWeek": 3, "SubjectType": "Theory"},
        {"Class": "CSE-B", "Subject": "Database Systems", "Faculty": "Amit", "HoursPerWeek": 3, "SubjectType": "Theory"},
        {"Class": "CSE-B", "Subject": "DBMS Lab", "Faculty": "Amit", "HoursPerWeek": 3, "SubjectType": "Lab"},
        {"Class": "CSE-B", "Subject": "Python Elective", "Faculty": "Sunil", "HoursPerWeek": 3, "SubjectType": "Elective"},

        # CAI-A
        {"Class": "CAI-A", "Subject": "Artificial Intelligence", "Faculty": "Sunil", "HoursPerWeek": 4, "SubjectType": "Theory"},
        {"Class": "CAI-A", "Subject": "Neural Networks", "Faculty": "Priya", "HoursPerWeek": 3, "SubjectType": "Theory"},
        {"Class": "CAI-A", "Subject": "AI Lab", "Faculty": "Sunil", "HoursPerWeek": 3, "SubjectType": "Lab"},
        {"Class": "CAI-A", "Subject": "Python Elective", "Faculty": "Ravi", "HoursPerWeek": 3, "SubjectType": "Elective"},

        # CSM-A
        {"Class": "CSM-A", "Subject": "Machine Learning", "Faculty": "Priya", "HoursPerWeek": 4, "SubjectType": "Theory"},
        {"Class": "CSM-A", "Subject": "Data Warehousing", "Faculty": "Amit", "HoursPerWeek": 3, "SubjectType": "Theory"},
        {"Class": "CSM-A", "Subject": "ML Lab", "Faculty": "Priya", "HoursPerWeek": 3, "SubjectType": "Lab"},
        {"Class": "CSM-A", "Subject": "Python Elective", "Faculty": "Sunil", "HoursPerWeek": 3, "SubjectType": "Elective"},
    ])

    # 3. Faculty sheet
    faculty_df = pd.DataFrame([
        {"FacultyName": "Ravi", "Department": "Computer Science", "Available": "All"},
        {"FacultyName": "Priya", "Department": "Computer Science", "Available": "All"},
        {"FacultyName": "Amit", "Department": "Computer Science", "Available": "All"},
        {"FacultyName": "Sunil", "Department": "Information Technology", "Available": "Monday,Tuesday,Wednesday,Thursday,Friday"},
    ])

    # 4. Constraints sheet (vertical format)
    constraints_df = pd.DataFrame([
        ["Working Days", "Monday,Tuesday,Wednesday,Thursday,Friday"],
        ["Periods Per Day", 7],
        ["Lunch Break", 4],
        ["Break Period", 2],
        ["Max Consecutive Classes", 3],
        ["Maximum Daily Hours", 6]
    ], columns=["Constraint Key", "Constraint Value"])

    # Write all dataframes to Excel sheets
    with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
        classes_df.to_excel(writer, sheet_name="Classes", index=False)
        subjects_df.to_excel(writer, sheet_name="Subjects", index=False)
        faculty_df.to_excel(writer, sheet_name="Faculty", index=False)
        constraints_df.to_excel(writer, sheet_name="Constraints", index=False)

    print("Sample Excel workbook generated successfully.")


if __name__ == "__main__":
    generate_sample_excel()
