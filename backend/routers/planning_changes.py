"""Router: Planungsänderungs-Log – Anzeige und Excel-Download."""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from ..auth import get_current_user
from ..database import get_db as get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/planning-changes", tags=["PlanungsÄnderungen"])


def _load_config(supabase) -> dict:
    resp = supabase.table("app_config").select("key, value").execute()
    return {row["key"]: row["value"] for row in (resp.data or [])}


def _get_allowed_roles(config: dict, key: str) -> list[str]:
    raw = config.get(key, "admin,manager")
    return [r.strip() for r in raw.split(",") if r.strip()]


def _require_config_role(config: dict, key: str, current_user: dict):
    allowed = _get_allowed_roles(config, key)
    if current_user.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Keine Berechtigung")


@router.get("")
async def list_changes(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    user_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    config = _load_config(supabase)
    _require_config_role(config, "change_notification_roles", current_user)

    query = supabase.table("planning_change_log").select("*").order(
        "changed_at", desc=True
    ).limit(200)

    if year:
        query = query.eq("plan_year", year)
    if month:
        query = query.eq("plan_month", month)
    if user_id:
        query = query.eq("affected_user_id", user_id)
    if project_id:
        query = query.eq("project_id", project_id)

    resp = query.execute()
    return resp.data or []


@router.patch("/{change_id}/acknowledge")
async def acknowledge_change(
    change_id: str,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Setzt den Status eines Planungsänderungs-Eintrags auf 'Übernommen'. Nur für Planer."""
    if not current_user.get("is_planer"):
        raise HTTPException(status_code=403, detail="Keine Berechtigung – Planer-Rolle erforderlich")

    # Eintrag laden
    resp = supabase.table("planning_change_log").select(
        "id, acknowledged_at"
    ).eq("id", change_id).maybe_single().execute()

    if not resp.data:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")

    if resp.data.get("acknowledged_at") is not None:
        raise HTTPException(status_code=409, detail="Eintrag wurde bereits als 'Übernommen' markiert")

    now = datetime.now(timezone.utc).isoformat()
    update_resp = supabase.table("planning_change_log").update({
        "acknowledged_by": current_user["id"],
        "acknowledged_at": now,
    }).eq("id", change_id).execute()

    if not update_resp.data:
        raise HTTPException(status_code=500, detail="Fehler beim Aktualisieren")

    return update_resp.data[0]


@router.get("/report/excel")
async def download_excel(
    from_date: str = Query(..., description="YYYY-MM-DD"),
    to_date: str = Query(..., description="YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    config = _load_config(supabase)
    _require_config_role(config, "change_report_roles", current_user)

    resp = supabase.table("planning_change_log").select("*").gte(
        "changed_at", f"{from_date}T00:00:00"
    ).lte(
        "changed_at", f"{to_date}T23:59:59"
    ).order("changed_at", desc=False).execute()

    changes = resp.data or []

    # User-Map
    user_resp = supabase.table("users").select("id, username, display_name").execute()
    users_by_id = {u["id"]: u for u in (user_resp.data or [])}

    # Projekt-Map
    proj_resp = supabase.table("projects").select(
        "id, name, short_code, customers(name)"
    ).execute()
    projects_by_id = {p["id"]: p for p in (proj_resp.data or [])}

    from ..services.planning_changes_excel import generate_changes_excel
    xlsx_bytes = generate_changes_excel(
        changes=changes,
        from_date=from_date,
        to_date=to_date,
        config=config,
        users_by_id=users_by_id,
        projects_by_id=projects_by_id,
    )

    filename = f"planungsaenderungen_{from_date}_{to_date}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
