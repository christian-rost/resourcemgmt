"""Zeitplanung router: Ressourcenplanung, Budget-Validierung."""
import logging
from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from ..auth import get_current_user, require_role
from ..main import get_supabase

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
        "*, projects(name, short_code, budget_hours, customers(name, short_code))"
    ).eq("plan_year", year).eq("plan_month", month)

    if role == "consultant":
        query = query.eq("user_id", current_user["id"])
    elif user_id:
        query = query.eq("user_id", user_id)

    if project_id:
        query = query.eq("project_id", project_id)

    resp = query.order("user_id").execute()
    return resp.data or []


@router.post("/entries", status_code=201)
async def create_plan_entry(
    body: PlanEntryCreate,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    resp = supabase.table("planning_entries").insert(body.model_dump()).execute()
    return resp.data[0]


@router.put("/entries/{entry_id}")
async def update_plan_entry(
    entry_id: str,
    body: PlanEntryUpdate,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    data["updated_at"] = "now()"
    resp = supabase.table("planning_entries").update(data).eq("id", entry_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Planning entry not found")
    return resp.data[0]


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_plan_entry(
    entry_id: str,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    supabase.table("planning_entries").delete().eq("id", entry_id).execute()


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
