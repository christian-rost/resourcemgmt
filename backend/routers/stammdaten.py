"""Stammdaten router: Kunden, Projekte, Berater-Zuordnungen."""
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import get_current_user, require_role
from ..database import get_db as get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/stammdaten", tags=["Stammdaten"])


# ── Pydantic Models ─────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    name: str
    short_code: Optional[str] = None
    is_active: bool = True


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    short_code: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectCreate(BaseModel):
    customer_id: str
    name: str
    short_code: Optional[str] = None
    budget_hours: float = 0
    is_active: bool = True


class ProjectUpdate(BaseModel):
    customer_id: Optional[str] = None
    name: Optional[str] = None
    short_code: Optional[str] = None
    budget_hours: Optional[float] = None
    is_active: Optional[bool] = None


class AssignmentCreate(BaseModel):
    project_id: str
    user_id: str


# ── Kunden ──────────────────────────────────────────────────────────────────

@router.get("/customers")
async def list_customers(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    resp = supabase.table("customers").select("*").order("name").execute()
    return resp.data or []


@router.post("/customers", status_code=201)
async def create_customer(
    body: CustomerCreate,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    resp = supabase.table("customers").insert(body.model_dump()).execute()
    return resp.data[0]


@router.put("/customers/{customer_id}")
async def update_customer(
    customer_id: str,
    body: CustomerUpdate,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    resp = supabase.table("customers").update(data).eq("id", customer_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Customer not found")
    return resp.data[0]


@router.delete("/customers/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: str,
    current_user: dict = Depends(require_role("admin")),
    supabase=Depends(get_supabase),
):
    supabase.table("customers").delete().eq("id", customer_id).execute()


# ── Projekte ─────────────────────────────────────────────────────────────────

@router.get("/projects")
async def list_projects(
    customer_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    query = supabase.table("projects").select("*, customers(name, short_code)").order("name")
    if customer_id:
        query = query.eq("customer_id", customer_id)
    resp = query.execute()
    return resp.data or []


@router.get("/projects/assigned")
async def list_assigned_projects(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Projects assigned to the current user (for consultants)."""
    role = current_user.get("role")
    if role in ("admin", "manager"):
        # Admins and managers see all active projects
        resp = supabase.table("projects").select(
            "*, customers(name, short_code)"
        ).eq("is_active", True).order("name").execute()
        return resp.data or []

    user_id = current_user["id"]
    resp = supabase.table("project_assignments").select(
        "project_id, projects(*, customers(name, short_code))"
    ).eq("user_id", user_id).execute()
    return [row["projects"] for row in (resp.data or []) if row.get("projects")]


@router.post("/projects", status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    resp = supabase.table("projects").insert(body.model_dump()).execute()
    return resp.data[0]


@router.put("/projects/{project_id}")
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    resp = supabase.table("projects").update(data).eq("id", project_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Project not found")
    return resp.data[0]


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    current_user: dict = Depends(require_role("admin")),
    supabase=Depends(get_supabase),
):
    supabase.table("projects").delete().eq("id", project_id).execute()


# ── Berater-Zuordnungen ──────────────────────────────────────────────────────

@router.get("/assignments")
async def list_assignments(
    project_id: Optional[str] = None,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    query = supabase.table("project_assignments").select("*")
    if project_id:
        query = query.eq("project_id", project_id)
    resp = query.execute()
    return resp.data or []


@router.post("/assignments", status_code=201)
async def create_assignment(
    body: AssignmentCreate,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    try:
        resp = supabase.table("project_assignments").insert(body.model_dump()).execute()
        return resp.data[0]
    except Exception:
        raise HTTPException(status_code=409, detail="Assignment already exists")


@router.delete("/assignments/{assignment_id}", status_code=204)
async def delete_assignment(
    assignment_id: str,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    supabase.table("project_assignments").delete().eq("id", assignment_id).execute()
