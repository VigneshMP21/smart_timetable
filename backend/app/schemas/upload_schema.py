"""
Purpose: Bulk Upload Pydantic Schemas
Author: Smart Timetable Backend Team
Module Description: Defines response shapes for the single-workbook Smart
Timetable import (POST /upload) and the sample template download
(GET /upload/template).
"""

from pydantic import BaseModel, Field


class EntityImportSummary(BaseModel):
    """
    Import counts for a single sheet of the workbook.
    """

    total: int = Field(..., description="Valid rows parsed from the sheet")
    imported: int = Field(..., description="Rows inserted into the database")
    skipped: int = Field(..., description="Rows skipped because they already exist")


class BulkImportSummary(BaseModel):
    """
    Response shape for POST /upload (the 4-sheet bulk import).
    """

    status: str = "success"
    message: str = "Workbook imported successfully."
    classes: EntityImportSummary
    rooms: EntityImportSummary
    subjects: EntityImportSummary
    faculty: EntityImportSummary
    imported_total: int = Field(..., description="Total rows inserted across all sheets")
    skipped_total: int = Field(..., description="Total duplicate rows skipped across all sheets")
