"""
Purpose: PDF Export Service
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Generates styled, print-ready landscape PDF schedules
using ReportLab. Each class gets its own page with a header (short code,
section, class name, room) and a Day x Period grid sourced from the saved
timetable entries (including manual edits).
"""

from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

from app.services.export_data import load_export_data
from app.utils.logger import get_logger

logger = get_logger(__name__)

TYPE_COLORS = {
    "Theory": ("#EBF3FC", "#2563EB"),
    "Lab": ("#EAF9EB", "#16A34A"),
    "Elective": ("#FEF5E7", "#D97706"),
    "Free": ("#F9FAFB", "#9CA3AF"),
    "Break": ("#F2F4F5", "#6B7280"),
    "Lunch": ("#E6E8EA", "#6B7280"),
}


class NumberedCanvas(canvas.Canvas):
    """
    Custom canvas that prints 'Page X of Y' in the footer.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#555555"))
        self.drawRightString(788, 36, f"Page {self._pageNumber} of {page_count}")
        self.drawString(54, 36, "Generated Automatically | Academic Scheduling Board")
        self.line(54, 48, 788, 48)
        self.restoreState()


class PDFExportService:
    """
    Exports generated class schedules as a professional landscaped PDF document.
    """

    @classmethod
    async def export_timetable(
        cls,
        db,
        output_path: Path,
        user_id: Optional[str] = None,
    ) -> None:
        """
        Creates a PDF file from the saved timetable records.

        Args:
            db (AsyncSession): Active database session.
            output_path (Path): File path destination.
            user_id (Optional[str]): Scopes the Setup config lookup.
        """
        logger.info(f"Generating PDF timetable export at: {output_path}")

        class_models, config, formatted = await load_export_data(db, user_id)
        working_days = config["working_days"]
        periods = config["periods"]

        if not formatted:
            raise ValueError("No timetable data available for export.")

        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=landscape(A4),
            leftMargin=54,
            rightMargin=54,
            topMargin=60,
            bottomMargin=56,
        )

        styles = getSampleStyleSheet()

        class_name_style = ParagraphStyle(
            name="ClassName",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            textColor=colors.HexColor("#1B365D"),
            alignment=1,
        )
        meta_style = ParagraphStyle(
            name="Meta",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=colors.HexColor("#333333"),
            alignment=0,
        )
        title_style = ParagraphStyle(
            name="Title",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=15,
            textColor=colors.HexColor("#1B365D"),
            alignment=1,
            spaceBefore=6,
            spaceAfter=12,
        )
        cell_text_style = ParagraphStyle(
            name="CellText",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            alignment=1,
        )
        cell_bold_style = ParagraphStyle(
            name="CellBold",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            alignment=1,
        )
        cell_header_style = ParagraphStyle(
            name="CellHeader",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            alignment=1,
            textColor=colors.white,
        )
        day_cell_style = ParagraphStyle(
            name="DayCell",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            alignment=1,
        )

        elements = []

        for cm in class_models:
            label = cm["label"]
            class_data = formatted.get(label, {})

            # Header table: short_code (left), section (left), class name
            # (centered), room (right).
            header_table = Table(
                [
                    [
                        Paragraph(f"<b>Branch:</b><br/>{cm['short_code']}", meta_style),
                        Paragraph(f"<b>Section:</b><br/>{cm['section']}", meta_style),
                        Paragraph(cm["class_name"], class_name_style),
                        Paragraph(f"<b>Room:</b><br/>{cm.get('room_no') or '-'}", meta_style),
                    ]
                ],
                colWidths=[150, 150, 240, 150],
            )
            header_table.setStyle(
                TableStyle(
                    [
                        ("ALIGN", (0, 0), (1, 0), "LEFT"),
                        ("ALIGN", (2, 0), (2, 0), "CENTER"),
                        ("ALIGN", (3, 0), (3, 0), "RIGHT"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#1B365D")),
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F7FA")),
                        ("TOPPADDING", (0, 0), (-1, -1), 8),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            elements.append(header_table)
            elements.append(Paragraph("TIME TABLE", title_style))

            col_widths = [70] + [590 / len(periods)] * len(periods)
            table_data = []

            header_row = [Paragraph("Day", cell_header_style)]
            for p in periods:
                if p.get("is_break", False):
                    header_text = f"BREAK<br/>{p['start_time']}-{p['end_time']}"
                elif p.get("is_lunch", False):
                    header_text = f"LUNCH<br/>{p['start_time']}-{p['end_time']}"
                else:
                    header_text = f"P{p['period_number']}<br/>{p['start_time']}-{p['end_time']}"
                header_row.append(Paragraph(header_text, cell_header_style))
            table_data.append(header_row)

            style_cmds = [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1B365D")),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#1B365D")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]

            for row_idx, day in enumerate(working_days, start=1):
                row = [Paragraph(f"<b>{day}</b>", day_cell_style)]
                style_cmds.append(
                    ("BACKGROUND", (0, row_idx), (0, row_idx), colors.HexColor("#F2F4F5"))
                )

                day_slots = class_data.get(day, [])
                for idx, slot in enumerate(day_slots):
                    col_idx = idx + 1
                    slot_type = slot["type"]
                    bg, _border = TYPE_COLORS.get(slot_type, TYPE_COLORS["Free"])

                    if slot_type in ("Break", "Lunch"):
                        row.append(Paragraph(slot["subject"].upper(), cell_bold_style))
                    elif slot_type == "Free":
                        row.append(Paragraph("Free Period", cell_text_style))
                    else:
                        row.append(
                            Paragraph(
                                f"<b>{slot['subject']}</b><br/>{slot['faculty']}",
                                cell_text_style,
                            )
                        )
                    style_cmds.append(
                        ("BACKGROUND", (col_idx, row_idx), (col_idx, row_idx), colors.HexColor(bg))
                    )

                table_data.append(row)

            timetable_table = Table(table_data, colWidths=col_widths, repeatRows=1)
            timetable_table.setStyle(TableStyle(style_cmds))
            elements.append(timetable_table)

            elements.append(Spacer(1, 16))
            legend_cells = [
                Paragraph("<b>Legends:</b>", cell_bold_style),
            ]
            for legend_type, (_bg, _border) in TYPE_COLORS.items():
                legend_cells.append(Paragraph(legend_type, cell_text_style))
            legend_table = Table([legend_cells], colWidths=[90] + [92] * (len(TYPE_COLORS) - 1) + [92])
            legend_style = [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
            for idx, (legend_type, (_bg, _border)) in enumerate(TYPE_COLORS.items(), start=1):
                legend_style.append(("BACKGROUND", (idx, 0), (idx, 0), colors.HexColor(_bg)))
            legend_table.setStyle(TableStyle(legend_style))
            elements.append(legend_table)

            elements.append(PageBreak())

        doc.build(elements, canvasmaker=NumberedCanvas)
        logger.info("Successfully generated landscaped PDF timetable.")
