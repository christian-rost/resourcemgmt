"""Reports router: PDF-Export, CSV-Export."""
import io
import logging
import zipfile
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..auth import get_current_user, require_role
from ..database import get_db as get_supabase
from ..services.pdf_service import generate_timesheet_pdf
from ..user_storage import get_user_by_id, list_users

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/pdf")
async def export_pdf(
    year: int = Query(...),
    month: int = Query(...),
    project_id: str = Query(...),
    user_id: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """
    REQ-16: PDF export of monthly timesheet per customer/project.
    REQ-17: billable_only=True filters to externally reportable entries.
    """
    role = current_user.get("role")
    effective_user_id = user_id if role in ("admin", "manager") and user_id else current_user["id"]

    # Determine display name of the target user
    if effective_user_id != current_user["id"]:
        target_user = get_user_by_id(effective_user_id)
        user_display = target_user.get("display_name", target_user.get("username", "")) if target_user else ""
    else:
        user_display = current_user.get("display_name", current_user.get("username", ""))

    start = date(year, month, 1).isoformat()
    end = date(year + 1, 1, 1).isoformat() if month == 12 else date(year, month + 1, 1).isoformat()

    # Fetch entries
    query = supabase.table("time_entries").select(
        "*, projects(name, short_code, budget_hours, customers(name, short_code))"
    ).eq("user_id", effective_user_id).eq("project_id", project_id).gte(
        "entry_date", start
    ).lt("entry_date", end).eq("status", "approved")

    if billable_only:
        query = query.eq("is_billable", True)

    resp = query.order("entry_date").execute()
    entries = resp.data or []

    # Fetch config
    config_resp = supabase.table("app_config").select("*").execute()
    config = {row["key"]: row["value"] for row in (config_resp.data or [])}

    # Fetch project info
    proj_resp = supabase.table("projects").select(
        "*, customers(name)"
    ).eq("id", project_id).execute()
    project = proj_resp.data[0] if proj_resp.data else {}

    pdf_bytes = generate_timesheet_pdf(
        entries=entries,
        project=project,
        year=year,
        month=month,
        config=config,
        user_display=user_display,
    )

    month_str = f"{year}-{month:02d}"
    proj_name = (project.get("name") or "projekt").replace(" ", "_")
    filename = f"Zeiterfassung_{proj_name}_{month_str}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/pdf-all")
async def export_pdf_all(
    year: int = Query(...),
    month: int = Query(...),
    project_id: str = Query(...),
    billable_only: bool = Query(False),
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    """Export PDFs for all users with entries in this project/month as a ZIP."""
    start = date(year, month, 1).isoformat()
    end = date(year + 1, 1, 1).isoformat() if month == 12 else date(year, month + 1, 1).isoformat()

    # Fetch config and project info once
    config_resp = supabase.table("app_config").select("*").execute()
    config = {row["key"]: row["value"] for row in (config_resp.data or [])}

    proj_resp = supabase.table("projects").select("*, customers(name)").eq("id", project_id).execute()
    project = proj_resp.data[0] if proj_resp.data else {}

    users = list_users()

    zip_buf = io.BytesIO()
    pdf_count = 0
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for user in users:
            query = supabase.table("time_entries").select(
                "*, projects(name, short_code, budget_hours, customers(name, short_code))"
            ).eq("user_id", user["id"]).eq("project_id", project_id).gte(
                "entry_date", start
            ).lt("entry_date", end).eq("status", "approved")
            if billable_only:
                query = query.eq("is_billable", True)
            resp = query.order("entry_date").execute()
            entries = resp.data or []

            if not entries:
                continue  # skip users with no entries for this project/month

            user_display = user.get("display_name") or user.get("username", "")
            pdf_bytes = generate_timesheet_pdf(
                entries=entries,
                project=project,
                year=year,
                month=month,
                config=config,
                user_display=user_display,
            )

            month_str = f"{year}-{month:02d}"
            proj_name = (project.get("name") or "Projekt").replace(" ", "_")
            safe_name = (user.get("username", "user")).replace(" ", "_")
            zf.writestr(f"Zeiterfassung_{proj_name}_{month_str}_{safe_name}.pdf", pdf_bytes)
            pdf_count += 1

    if pdf_count == 0:
        raise HTTPException(status_code=404, detail="Keine freigegebenen Einträge für dieses Projekt/Monat gefunden")

    zip_buf.seek(0)
    month_str = f"{year}-{month:02d}"
    proj_name = (project.get("name") or "Projekt").replace(" ", "_")

    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=Zeiterfassung_{proj_name}_{month_str}_alle.zip"},
    )
