"""PDF generation service using reportlab."""
import calendar
import io
from datetime import date
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)

# Default corporate design colors
DEFAULT_PRIMARY = "#ee7f00"
DEFAULT_DARK = "#213452"


def _hex_to_color(hex_str: str):
    """Convert hex color string to reportlab Color."""
    hex_str = hex_str.lstrip("#")
    r, g, b = int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16)
    return colors.Color(r / 255, g / 255, b / 255)


def generate_timesheet_pdf(
    entries: list[dict],
    project: dict,
    year: int,
    month: int,
    config: dict,
    user_display: str = "",
) -> bytes:
    """Generate a PDF timesheet report."""
    primary_color = _hex_to_color(config.get("primary_color", DEFAULT_PRIMARY))
    dark_color = _hex_to_color(config.get("dark_color", DEFAULT_DARK))
    company_name = config.get("company_name", "Unternehmensberatung")
    hours_per_day = float(config.get("hours_per_day", "8"))

    customer = project.get("customers") or {}
    customer_name = customer.get("name", "")
    project_name = project.get("name", "")
    GERMAN_MONTHS = ["", "Januar", "Februar", "März", "April", "Mai", "Juni",
                     "Juli", "August", "September", "Oktober", "November", "Dezember"]
    month_name = GERMAN_MONTHS[month]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Normal"],
        fontSize=18,
        textColor=dark_color,
        fontName="Helvetica-Bold",
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=primary_color,
        fontName="Helvetica-Bold",
        spaceAfter=4,
    )
    meta_style = ParagraphStyle(
        "Meta",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#666666"),
        spaceAfter=2,
    )

    elements = []

    # Header
    elements.append(Paragraph(company_name, title_style))
    elements.append(Paragraph(f"Leistungsnachweis — {month_name} {year}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=primary_color, spaceAfter=8))
    elements.append(Paragraph(f"Kunde: {customer_name}", meta_style))
    elements.append(Paragraph(f"Projekt: {project_name}", meta_style))
    if user_display:
        elements.append(Paragraph(f"Berater: {user_display}", meta_style))
    elements.append(Spacer(1, 0.5 * cm))

    # Table
    col_widths = [3 * cm, 3 * cm, 2.5 * cm, 2.5 * cm, 1.5 * cm, 5.5 * cm]
    header_row = ["Datum", "Wochentag", "Stunden", "Pause (h)", "Abr.", "Kommentar"]

    rows = [header_row]
    total_hours = 0.0
    total_break = 0.0

    for e in entries:
        d = date.fromisoformat(e["entry_date"])
        rows.append([
            d.strftime("%d.%m.%Y"),
            _german_weekday(d.weekday()),
            f"{e['hours']:.2f}",
            f"{e.get('break_hours', 0):.2f}",
            "✓" if e.get("is_billable") else "–",
            e.get("comment") or "",
        ])
        total_hours += e["hours"]
        total_break += e.get("break_hours", 0)

    # Summary row
    total_days = total_hours / hours_per_day if hours_per_day else 0
    rows.append([
        "Gesamt", "",
        f"{total_hours:.2f} h",
        f"{total_break:.2f} h",
        "",
        f"{total_days:.1f} PT",
    ])

    table = Table(rows, colWidths=col_widths)
    table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), dark_color),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        # Data rows
        ("FONTSIZE", (0, 1), (-1, -2), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f5f5f5")]),
        ("TOPPADDING", (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        # Summary row
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f0f0f0")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 9),
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, primary_color),
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
        ("BOX", (0, 0), (-1, -1), 1, dark_color),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(table)

    # Footer summary
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(
        f"Gesamtstunden: <b>{total_hours:.2f} h</b> = <b>{total_days:.1f} Personentage</b> "
        f"(Basis: {hours_per_day:.0f} h/Tag)",
        meta_style,
    ))
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph("Unterschrift Berater: ___________________________", meta_style))
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph("Unterschrift Kunde: ___________________________", meta_style))

    doc.build(elements)
    return buf.getvalue()


def _german_weekday(weekday: int) -> str:
    days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
    return days[weekday]
