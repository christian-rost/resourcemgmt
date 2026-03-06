"""Zeiterfassung router: Buchungen, Status, Genehmigungsworkflow."""
import logging
from typing import Optional
from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from ..auth import get_current_user, require_role
from ..database import get_db as get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/zeiterfassung", tags=["Zeiterfassung"])

VALID_STATUSES = ("draft", "submitted", "approved", "rejected")


# ── Pydantic Models ─────────────────────────────────────────────────────────

class TimeEntryCreate(BaseModel):
    project_id: str
    entry_date: date
    start_time: time
    end_time: time
    break_hours: float = 0.0
    comment: Optional[str] = None
    is_billable: bool = True
    project_role_rate_id: Optional[str] = None

    @field_validator("break_hours")
    @classmethod
    def break_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Break hours cannot be negative")
        return round(v, 2)


class TimeEntryUpdate(BaseModel):
    project_id: Optional[str] = None
    entry_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    break_hours: Optional[float] = None
    comment: Optional[str] = None
    is_billable: Optional[bool] = None
    project_role_rate_id: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str
    rejection_reason: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"Status must be one of {VALID_STATUSES}")
        return v


class CopyRequest(BaseModel):
    entry_ids: list[str]
    target_date: date


# ── Helpers ──────────────────────────────────────────────────────────────────

def _calc_hours(start_str: str, end_str: str, break_hours: float) -> float:
    sh, sm = int(start_str[:2]), int(start_str[3:5])
    eh, em = int(end_str[:2]), int(end_str[3:5])
    work_mins = (eh * 60 + em) - (sh * 60 + sm) - round(break_hours * 60)
    if work_mins <= 0:
        raise ValueError("Arbeitszeit nach Pause muss positiv sein")
    return round(work_mins / 60, 2)


def _can_edit(entry: dict, current_user: dict) -> bool:
    """Only the owner can edit draft entries; admins always can."""
    if current_user.get("role") == "admin":
        return True
    return (
        entry.get("user_id") == current_user["id"]
        and entry.get("status") == "draft"
    )


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/entries")
async def list_entries(
    year: int = Query(...),
    month: int = Query(...),
    day: Optional[int] = Query(None),
    user_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """
    List time entries for a period.
    - Consultants only see their own entries.
    - Managers/Admins can filter by user_id.
    """
    role = current_user.get("role")
    effective_user_id = user_id if role in ("admin", "manager") and user_id else current_user["id"]

    query = supabase.table("time_entries").select(
        "*, projects(name, short_code, customers(name, short_code)), "
        "project_role_rates(id, daily_rate_eur, travel_cost_flat_eur, custom_role_name, "
        "project_roles(name))"
    )

    if role == "consultant":
        query = query.eq("user_id", current_user["id"])
    else:
        if user_id:
            query = query.eq("user_id", user_id)

    if day:
        target_date = date(year, month, day).isoformat()
        query = query.eq("entry_date", target_date)
    else:
        start = date(year, month, 1).isoformat()
        # Last day of month: use next month - 1
        if month == 12:
            end = date(year + 1, 1, 1).isoformat()
        else:
            end = date(year, month + 1, 1).isoformat()
        query = query.gte("entry_date", start).lt("entry_date", end)

    if project_id:
        query = query.eq("project_id", project_id)

    resp = query.order("entry_date").order("created_at").execute()
    return resp.data or []


@router.post("/entries", status_code=201)
async def create_entry(
    body: TimeEntryCreate,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    data = body.model_dump()
    data["entry_date"] = data["entry_date"].isoformat()
    data["start_time"] = data["start_time"].strftime("%H:%M:%S")
    data["end_time"] = data["end_time"].strftime("%H:%M:%S")
    try:
        data["hours"] = _calc_hours(data["start_time"], data["end_time"], data.get("break_hours", 0))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    data["user_id"] = current_user["id"]
    data["status"] = "draft"
    resp = supabase.table("time_entries").insert(data).execute()
    return resp.data[0]


@router.put("/entries/{entry_id}")
async def update_entry(
    entry_id: str,
    body: TimeEntryUpdate,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    existing = supabase.table("time_entries").select("*").eq("id", entry_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry = existing.data[0]
    if not _can_edit(entry, current_user):
        raise HTTPException(status_code=403, detail="Cannot edit this entry")

    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if "entry_date" in data:
        data["entry_date"] = data["entry_date"].isoformat()
    if "start_time" in data:
        data["start_time"] = data["start_time"].strftime("%H:%M:%S")
    if "end_time" in data:
        data["end_time"] = data["end_time"].strftime("%H:%M:%S")
    if any(k in data for k in ("start_time", "end_time", "break_hours")):
        st = data.get("start_time") or entry.get("start_time")
        et = data.get("end_time") or entry.get("end_time")
        bh = data.get("break_hours", entry.get("break_hours", 0))
        if st and et:
            try:
                data["hours"] = _calc_hours(st, et, bh)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))
    data["updated_at"] = "now()"
    resp = supabase.table("time_entries").update(data).eq("id", entry_id).execute()
    return resp.data[0]


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    existing = supabase.table("time_entries").select("*").eq("id", entry_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry = existing.data[0]
    if not _can_edit(entry, current_user):
        raise HTTPException(status_code=403, detail="Cannot delete this entry")
    supabase.table("time_entries").delete().eq("id", entry_id).execute()


@router.post("/entries/{entry_id}/status")
async def update_status(
    entry_id: str,
    body: StatusUpdate,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """
    Status transitions:
    - consultant: draft → submitted
    - manager/admin: submitted → approved | rejected
    """
    existing = supabase.table("time_entries").select("*").eq("id", entry_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry = existing.data[0]

    role = current_user.get("role")
    current_status = entry.get("status")

    # Validate transitions
    if body.status == "submitted":
        if current_status != "draft":
            raise HTTPException(status_code=400, detail="Only draft entries can be submitted")
        if entry["user_id"] != current_user["id"] and role != "admin":
            raise HTTPException(status_code=403, detail="Can only submit own entries")
    elif body.status in ("approved", "rejected"):
        if role not in ("admin", "manager"):
            raise HTTPException(status_code=403, detail="Only managers/admins can approve")
        if role == "manager" and entry["user_id"] == current_user["id"]:
            raise HTTPException(status_code=403, detail="Manager kann eigene Einträge nicht selbst genehmigen")
        if current_status != "submitted":
            raise HTTPException(status_code=400, detail="Only submitted entries can be approved/rejected")
    elif body.status == "draft":
        if role not in ("admin", "manager") and entry["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    data: dict = {"status": body.status, "updated_at": "now()"}
    if body.status in ("approved", "rejected"):
        data["approved_by"] = current_user["id"]
        data["approved_at"] = date.today().isoformat()
    if body.status == "rejected" and body.rejection_reason:
        data["rejection_reason"] = body.rejection_reason

    resp = supabase.table("time_entries").update(data).eq("id", entry_id).execute()
    return resp.data[0]


@router.post("/entries/copy", status_code=201)
async def copy_entries(
    body: CopyRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Copy time entries to a new date (as draft)."""
    resp = supabase.table("time_entries").select("*").in_("id", body.entry_ids).execute()
    entries = resp.data or []
    if not entries:
        raise HTTPException(status_code=404, detail="No entries found")

    new_entries = []
    for e in entries:
        if e["user_id"] != current_user["id"] and current_user.get("role") not in ("admin", "manager"):
            continue
        new_entries.append({
            "user_id": current_user["id"],
            "project_id": e["project_id"],
            "entry_date": body.target_date.isoformat(),
            "hours": e["hours"],
            "break_hours": e.get("break_hours", 0),
            "start_time": e.get("start_time"),
            "end_time": e.get("end_time"),
            "comment": e.get("comment"),
            "is_billable": e.get("is_billable", True),
            "project_role_rate_id": e.get("project_role_rate_id"),
            "status": "draft",
        })

    if not new_entries:
        raise HTTPException(status_code=403, detail="No entries to copy")

    resp = supabase.table("time_entries").insert(new_entries).execute()
    return resp.data


@router.get("/summary")
async def get_summary(
    year: int = Query(...),
    month: int = Query(...),
    user_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Aggregated hours per project for a month (for dashboard)."""
    role = current_user.get("role")
    effective_user_id = user_id if role in ("admin", "manager") and user_id else current_user["id"]

    start = date(year, month, 1).isoformat()
    end = date(year + 1, 1, 1).isoformat() if month == 12 else date(year, month + 1, 1).isoformat()

    resp = supabase.table("time_entries").select(
        "project_id, hours, status, entry_date, projects(name, customers(name))"
    ).eq("user_id", effective_user_id).gte("entry_date", start).lt("entry_date", end).execute()

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
                "total_hours": 0,
                "billable_hours": 0,
                "status_counts": {s: 0 for s in VALID_STATUSES},
            }
        by_project[pid]["total_hours"] += e["hours"]
        if e.get("is_billable"):
            by_project[pid]["billable_hours"] += e["hours"]
        by_project[pid]["status_counts"][e["status"]] += 1

    return list(by_project.values())


@router.get("/approval-queue")
async def approval_queue(
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    """All submitted entries awaiting approval.
    Managers only see entries from other users (not their own)."""
    query = supabase.table("time_entries").select(
        "*, projects(name, customers(name))"
    ).eq("status", "submitted").order("entry_date")
    if current_user.get("role") == "manager":
        query = query.neq("user_id", current_user["id"])
    resp = query.execute()
    return resp.data or []
