"""Zeitplanung router: Ressourcenplanung, Budget-Validierung."""
import logging
from typing import Optional
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from ..auth import get_current_user, require_role
from ..database import get_db as get_supabase
from ..services.email_service import send_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/zeitplanung", tags=["Zeitplanung"])


# ── Pydantic Models ─────────────────────────────────────────────────────────

class PlanEntryCreate(BaseModel):
    user_id: str
    project_id: str
    plan_year: int
    plan_month: int
    plan_day: Optional[int] = None  # None = monthly planning
    hours: float
    project_role_rate_id: Optional[str] = None

    @field_validator("hours")
    @classmethod
    def hours_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Hours must be positive")
        return round(v, 2)

    @field_validator("plan_month")
    @classmethod
    def valid_month(cls, v: int) -> int:
        if not (1 <= v <= 12):
            raise ValueError("Month must be between 1 and 12")
        return v


class PlanEntryUpdate(BaseModel):
    hours: Optional[float] = None
    plan_day: Optional[int] = None
    project_role_rate_id: Optional[str] = None


class CopyPlanRequest(BaseModel):
    source_year: int
    source_month: int
    target_year: int
    target_month: int
    user_id: Optional[str] = None  # None = copy for current user


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/entries")
async def list_plan_entries(
    year: int = Query(...),
    month: int = Query(...),
    user_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    role = current_user.get("role")
    query = supabase.table("planning_entries").select(
        "*, projects(name, short_code, budget_hours, budget_eur, customers(name, short_code)), "
        "project_role_rates(id, daily_rate_eur, travel_cost_flat_eur, custom_role_name, "
        "project_roles(name))"
    ).eq("plan_year", year).eq("plan_month", month)

    if role == "consultant":
        query = query.eq("user_id", current_user["id"])
    elif user_id:
        query = query.eq("user_id", user_id)

    if project_id:
        query = query.eq("project_id", project_id)

    resp = query.order("user_id").execute()
    return resp.data or []


def _load_smtp_config(supabase) -> dict:
    resp = supabase.table("app_config").select("key, value").execute()
    return {row["key"]: row["value"] for row in (resp.data or [])}


def _log_change(supabase, background_tasks: BackgroundTasks, action: str, changed_by: str,
                entry: dict, old_data: dict = None, new_data: dict = None):
    """Schreibt einen Eintrag in planning_change_log und sendet ggf. eine E-Mail."""
    log_entry = {
        "planning_entry_id": str(entry.get("id") or ""),
        "changed_by": changed_by,
        "action": action,
        "old_data": old_data,
        "new_data": new_data,
        "affected_user_id": entry.get("user_id"),
        "project_id": str(entry.get("project_id") or ""),
        "plan_year": entry.get("plan_year"),
        "plan_month": entry.get("plan_month"),
    }
    try:
        supabase.table("planning_change_log").insert(log_entry).execute()
    except Exception as e:
        logger.error(f"Failed to write planning_change_log: {e}")
        return

    # E-Mail-Benachrichtigung
    try:
        config = _load_smtp_config(supabase)
        smtp_host = config.get("smtp_host", "").strip()
        if not smtp_host:
            return

        notif_roles_raw = config.get("change_notification_roles", "admin,manager")
        notif_roles = [r.strip() for r in notif_roles_raw.split(",") if r.strip()]

        users_resp = supabase.table("users").select(
            "email, display_name, role"
        ).eq("is_active", True).execute()
        recipients = [
            u["email"] for u in (users_resp.data or [])
            if u.get("role") in notif_roles and u.get("email")
        ]
        if not recipients:
            return

        # Projekt-Name laden
        proj_id = entry.get("project_id") or ""
        proj_name = proj_id
        try:
            pr = supabase.table("projects").select("name").eq("id", proj_id).execute()
            if pr.data:
                proj_name = pr.data[0].get("name", proj_id)
        except Exception:
            pass

        # Betroffener User-Name
        aff_user_id = entry.get("user_id") or ""
        aff_name = aff_user_id
        try:
            ur = supabase.table("users").select("display_name, username").eq(
                "id", aff_user_id
            ).execute()
            if ur.data:
                aff_name = ur.data[0].get("display_name") or ur.data[0].get("username") or aff_user_id
        except Exception:
            pass

        action_labels = {"create": "erstellt", "update": "geändert", "delete": "gelöscht"}
        action_de = action_labels.get(action, action)

        old_h = (old_data or {}).get("hours", "–")
        new_h = (new_data or {}).get("hours", "–")
        year = entry.get("plan_year")
        month = entry.get("plan_month")
        months_de = {1:"Januar",2:"Februar",3:"März",4:"April",5:"Mai",6:"Juni",
                     7:"Juli",8:"August",9:"September",10:"Oktober",11:"November",12:"Dezember"}
        zeitraum = f"{months_de.get(month, month)} {year}" if year and month else ""

        subject = f"Planungsänderung {action_de}: {aff_name} / {proj_name}"
        body_html = f"""
        <html><body style="font-family:sans-serif;color:#213452">
        <h2 style="color:#ee7f00">Planungsänderung</h2>
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Aktion</td>
              <td style="padding:6px 12px">{action_de.capitalize()}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Berater</td>
              <td style="padding:6px 12px">{aff_name}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Projekt</td>
              <td style="padding:6px 12px">{proj_name}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Zeitraum</td>
              <td style="padding:6px 12px">{zeitraum}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Alt (Std)</td>
              <td style="padding:6px 12px">{old_h}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Neu (Std)</td>
              <td style="padding:6px 12px">{new_h}</td></tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:20px">XQT5 Ressource – automatische Benachrichtigung</p>
        </body></html>
        """
        background_tasks.add_task(send_email, config, recipients, subject, body_html)
    except Exception as e:
        logger.error(f"Failed to schedule change notification email: {e}")


def _get_daily_work_hours(supabase) -> float:
    resp = supabase.table("app_config").select("value").eq("key", "daily_work_hours").execute()
    if resp.data:
        try:
            return float(resp.data[0]["value"])
        except (ValueError, KeyError):
            pass
    return 8.0


@router.post("/entries", status_code=201)
async def create_plan_entry(
    body: PlanEntryCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    resp = supabase.table("planning_entries").insert(body.model_dump()).execute()
    created = resp.data[0]
    _log_change(supabase, background_tasks, "create", current_user["id"],
                created, old_data=None, new_data=created)
    return created


@router.put("/entries/{entry_id}")
async def update_plan_entry(
    entry_id: str,
    body: PlanEntryUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    old_resp = supabase.table("planning_entries").select("*").eq("id", entry_id).execute()
    old_entry = old_resp.data[0] if old_resp.data else {}

    data = {k: v for k, v in body.model_dump().items() if v is not None}
    data["updated_at"] = "now()"
    resp = supabase.table("planning_entries").update(data).eq("id", entry_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Planning entry not found")
    updated = resp.data[0]
    _log_change(supabase, background_tasks, "update", current_user["id"],
                updated, old_data=old_entry, new_data=updated)
    return updated


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_plan_entry(
    entry_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    old_resp = supabase.table("planning_entries").select("*").eq("id", entry_id).execute()
    old_entry = old_resp.data[0] if old_resp.data else {}
    supabase.table("planning_entries").delete().eq("id", entry_id).execute()
    if old_entry:
        _log_change(supabase, background_tasks, "delete", current_user["id"],
                    old_entry, old_data=old_entry, new_data=None)


@router.post("/entries/copy", status_code=201)
async def copy_plan_month(
    body: CopyPlanRequest,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    """Copy all planning entries from one month to another."""
    query = supabase.table("planning_entries").select("*").eq(
        "plan_year", body.source_year
    ).eq("plan_month", body.source_month)

    if body.user_id:
        query = query.eq("user_id", body.user_id)

    resp = query.execute()
    entries = resp.data or []
    if not entries:
        raise HTTPException(status_code=404, detail="No entries found to copy")

    new_entries = [
        {
            "user_id": e["user_id"],
            "project_id": e["project_id"],
            "plan_year": body.target_year,
            "plan_month": body.target_month,
            "plan_day": e.get("plan_day"),
            "hours": e["hours"],
            "project_role_rate_id": e.get("project_role_rate_id"),
        }
        for e in entries
    ]
    resp = supabase.table("planning_entries").insert(new_entries).execute()
    return resp.data


@router.get("/dashboard")
async def planning_dashboard(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    customer_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    """Global planning dashboard: all consultants, optional filters."""
    query = supabase.table("planning_entries").select(
        "*, projects(name, short_code, budget_hours, customer_id, customers(name, short_code))"
    ).eq("plan_year", year)

    if month:
        query = query.eq("plan_month", month)
    if project_id:
        query = query.eq("project_id", project_id)
    if user_id:
        query = query.eq("user_id", user_id)

    resp = query.execute()
    entries = resp.data or []

    # Filter by customer after fetch (via nested relation)
    if customer_id:
        entries = [
            e for e in entries
            if (e.get("projects") or {}).get("customer_id") == customer_id
        ]

    return entries


@router.get("/budget-validation")
async def budget_validation(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    """
    REQ-24/REQ-27: Compare planned hours vs. project budget.
    Returns projects where planned hours exceed budget (delta > 0).
    """
    query = supabase.table("planning_entries").select(
        "project_id, hours, projects(name, budget_hours, customers(name))"
    ).eq("plan_year", year)
    if month:
        query = query.eq("plan_month", month)

    resp = query.execute()
    entries = resp.data or []

    by_project: dict = {}
    for e in entries:
        pid = e["project_id"]
        if pid not in by_project:
            proj = e.get("projects") or {}
            cust = proj.get("customers") or {}
            by_project[pid] = {
                "project_id": pid,
                "project_name": proj.get("name", ""),
                "customer_name": cust.get("name", ""),
                "budget_hours": proj.get("budget_hours") or 0,
                "planned_hours": 0,
            }
        by_project[pid]["planned_hours"] += e["hours"]

    result = []
    for item in by_project.values():
        delta = item["planned_hours"] - item["budget_hours"]
        item["delta"] = round(delta, 2)
        item["over_budget"] = delta > 0
        result.append(item)

    return sorted(result, key=lambda x: x["delta"], reverse=True)


@router.get("/budget-validation-eur")
async def budget_validation_eur(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    """
    Monetäre Budget-Kontrolle: geplante EUR (Stunden × Stundensatz + Reisekosten)
    vs. Projekt-Budget in EUR. Gibt delta und over_budget zurück.
    """
    daily_work_hours = _get_daily_work_hours(supabase)

    query = supabase.table("planning_entries").select(
        "project_id, hours, project_role_rate_id, "
        "projects(name, budget_eur, customers(name)), "
        "project_role_rates(daily_rate_eur, travel_cost_flat_eur)"
    ).eq("plan_year", year)
    if month:
        query = query.eq("plan_month", month)

    resp = query.execute()
    entries = resp.data or []

    by_project: dict = {}
    for e in entries:
        pid = e["project_id"]
        if pid not in by_project:
            proj = e.get("projects") or {}
            cust = proj.get("customers") or {}
            by_project[pid] = {
                "project_id": pid,
                "project_name": proj.get("name", ""),
                "customer_name": cust.get("name", ""),
                "budget_eur": proj.get("budget_eur") or 0,
                "planned_eur": 0,
            }
        rate = e.get("project_role_rates") or {}
        daily_rate = rate.get("daily_rate_eur") or 0
        travel = rate.get("travel_cost_flat_eur") or 0
        hourly_rate = daily_rate / daily_work_hours if daily_work_hours else 0
        by_project[pid]["planned_eur"] += round(e["hours"] * hourly_rate + travel, 2)

    result = []
    for item in by_project.values():
        item["planned_eur"] = round(item["planned_eur"], 2)
        delta = item["planned_eur"] - item["budget_eur"]
        item["delta_eur"] = round(delta, 2)
        item["over_budget"] = delta > 0
        item["delta_pct"] = round(
            (delta / item["budget_eur"] * 100) if item["budget_eur"] else 0, 1
        )
        result.append(item)

    return sorted(result, key=lambda x: x["delta_eur"], reverse=True)


@router.get("/budget-dashboard")
async def budget_dashboard(
    project_id: str = Query(...),
    year: int = Query(...),
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    """
    Budget-Dashboard: monatliche Plan-EUR vs. Ist-EUR für ein Projekt,
    inkl. kumuliertem Trend und linearem Forecast.
    """
    daily_work_hours = _get_daily_work_hours(supabase)

    # Projektinfo + Budget
    proj_resp = supabase.table("projects").select(
        "name, budget_eur, budget_hours, customers(name)"
    ).eq("id", project_id).execute()
    project = proj_resp.data[0] if proj_resp.data else {}
    budget_eur = project.get("budget_eur") or 0

    # Planwerte je Monat
    plan_resp = supabase.table("planning_entries").select(
        "plan_month, hours, project_role_rates(daily_rate_eur, travel_cost_flat_eur)"
    ).eq("project_id", project_id).eq("plan_year", year).execute()

    plan_by_month: dict = {m: 0.0 for m in range(1, 13)}
    for e in (plan_resp.data or []):
        rate = e.get("project_role_rates") or {}
        daily_rate = rate.get("daily_rate_eur") or 0
        travel = rate.get("travel_cost_flat_eur") or 0
        hourly_rate = daily_rate / daily_work_hours if daily_work_hours else 0
        plan_by_month[e["plan_month"]] += e["hours"] * hourly_rate + travel

    # Istwerte je Monat (nur approved)
    start = date(year, 1, 1).isoformat()
    end = date(year + 1, 1, 1).isoformat()
    actual_resp = supabase.table("time_entries").select(
        "entry_date, hours, project_role_rates(daily_rate_eur, travel_cost_flat_eur)"
    ).eq("project_id", project_id).eq("status", "approved").gte(
        "entry_date", start
    ).lt("entry_date", end).execute()

    actual_by_month: dict = {m: 0.0 for m in range(1, 13)}
    for e in (actual_resp.data or []):
        m = int(e["entry_date"][5:7])
        rate = e.get("project_role_rates") or {}
        daily_rate = rate.get("daily_rate_eur") or 0
        travel = rate.get("travel_cost_flat_eur") or 0
        hourly_rate = daily_rate / daily_work_hours if daily_work_hours else 0
        actual_by_month[m] += e["hours"] * hourly_rate + travel

    # Monatliche Datenpunkte aufbauen
    months = []
    cumulative_plan = 0.0
    cumulative_actual = 0.0
    for m in range(1, 13):
        cumulative_plan += plan_by_month[m]
        cumulative_actual += actual_by_month[m]
        months.append({
            "month": m,
            "plan_eur": round(plan_by_month[m], 2),
            "actual_eur": round(actual_by_month[m], 2),
            "cumulative_plan_eur": round(cumulative_plan, 2),
            "cumulative_actual_eur": round(cumulative_actual, 2),
        })

    # Linearer Forecast: Hochrechnung auf Basis bisher erfasster Ist-Monate
    today = date.today()
    current_month = today.month if today.year == year else (12 if today.year > year else 0)
    months_with_actual = [m for m in range(1, current_month + 1) if actual_by_month[m] > 0]
    if months_with_actual and current_month > 0:
        avg_monthly_actual = cumulative_actual / len(months_with_actual)
        projected_annual = avg_monthly_actual * 12
    else:
        projected_annual = cumulative_plan

    forecast = {
        "projected_annual_eur": round(projected_annual, 2),
        "budget_eur": budget_eur,
        "projected_delta_eur": round(projected_annual - budget_eur, 2),
        "projected_over_budget": projected_annual > budget_eur,
    }

    return {
        "project": {
            "id": project_id,
            "name": project.get("name", ""),
            "customer_name": (project.get("customers") or {}).get("name", ""),
            "budget_eur": budget_eur,
        },
        "months": months,
        "forecast": forecast,
    }


@router.get("/soll-ist")
async def soll_ist_comparison(
    year: int = Query(...),
    month: int = Query(...),
    user_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """
    REQ-11/REQ-13: Compare planned vs. actual hours for a user in a month.
    """
    role = current_user.get("role")
    effective_user_id = user_id if role in ("admin", "manager") and user_id else current_user["id"]

    start = date(year, month, 1).isoformat()
    end = date(year + 1, 1, 1).isoformat() if month == 12 else date(year, month + 1, 1).isoformat()

    plan_resp = supabase.table("planning_entries").select(
        "project_id, hours, projects(name, customers(name))"
    ).eq("user_id", effective_user_id).eq("plan_year", year).eq("plan_month", month).execute()

    actual_resp = supabase.table("time_entries").select(
        "project_id, hours"
    ).eq("user_id", effective_user_id).gte("entry_date", start).lt("entry_date", end).execute()

    planned_by_project: dict = {}
    for p in (plan_resp.data or []):
        pid = p["project_id"]
        proj = p.get("projects") or {}
        cust = proj.get("customers") or {}
        if pid not in planned_by_project:
            planned_by_project[pid] = {
                "project_id": pid,
                "project_name": proj.get("name", ""),
                "customer_name": cust.get("name", ""),
                "planned_hours": 0,
                "actual_hours": 0,
            }
        planned_by_project[pid]["planned_hours"] += p["hours"]

    for a in (actual_resp.data or []):
        pid = a["project_id"]
        if pid in planned_by_project:
            planned_by_project[pid]["actual_hours"] += a["hours"]
        else:
            planned_by_project[pid] = {
                "project_id": pid,
                "project_name": "",
                "customer_name": "",
                "planned_hours": 0,
                "actual_hours": a["hours"],
            }

    result = []
    for item in planned_by_project.values():
        item["delta"] = round(item["actual_hours"] - item["planned_hours"], 2)
        result.append(item)

    return result
