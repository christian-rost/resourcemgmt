"""Zeiterfassung router: Buchungen, Status, Genehmigungsworkflow."""
import logging
from typing import Optional
from datetime import date

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
    hours: float
    break_hours: float = 0.0
    comment: Optional[str] = None
    is_billable: bool = True

    @field_validator("hours")
    @classmethod
    def hours_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Hours must be positive")
        return round(v, 2)

    @field_validator("break_hours")
    @classmethod
    def break_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Break hours cannot be negative")
        return round(v, 2)


class TimeEntryUpdate(BaseModel):
    project_id: Optional[str] = None
    entry_date: Optional[date] = None
    hours: Optional[float] = None
    break_hours: Optional[float] = None
    comment: Optional[str] = None
    is_billable: Optional[bool] = None


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
        "*, projects(name, short_code, customers(name, short_code))"
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
            "comment": e.get("comment"),
            "is_billable": e.get("is_billable", True),
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
    """All submitted entries awaiting approval."""
    resp = supabase.table("time_entries").select(
        "*, projects(name, customers(name))"
    ).eq("status", "submitted").order("entry_date").execute()
    return resp.data or []
