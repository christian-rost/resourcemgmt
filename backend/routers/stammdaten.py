"""Stammdaten router: Kunden, Projekte, Berater-Zuordnungen, Projekt-Rollen."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

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
    budget_eur: Optional[float] = None
    is_active: bool = True


class ProjectUpdate(BaseModel):
    customer_id: Optional[str] = None
    name: Optional[str] = None
    short_code: Optional[str] = None
    budget_hours: Optional[float] = None
    budget_eur: Optional[float] = None
    is_active: Optional[bool] = None


class AssignmentCreate(BaseModel):
    project_id: str
    user_id: str


class ProjectRoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True


class ProjectRoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectRoleRateCreate(BaseModel):
    role_id: Optional[str] = None
    custom_role_name: Optional[str] = None
    daily_rate_eur: float = 0
    travel_cost_flat_eur: float = 0
    is_active: bool = True

    @field_validator("daily_rate_eur", "travel_cost_flat_eur")
    @classmethod
    def non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Betrag darf nicht negativ sein")
        return round(v, 2)


class ProjectRoleRateUpdate(BaseModel):
    role_id: Optional[str] = None
    custom_role_name: Optional[str] = None
    daily_rate_eur: Optional[float] = None
    travel_cost_flat_eur: Optional[float] = None
    is_active: Optional[bool] = None

    @field_validator("daily_rate_eur", "travel_cost_flat_eur")
    @classmethod
    def non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Betrag darf nicht negativ sein")
        return round(v, 2) if v is not None else v


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


# ── Globale Projekt-Mitarbeiter-Rollen ───────────────────────────────────────

def _get_daily_work_hours(supabase) -> float:
    resp = supabase.table("app_config").select("value").eq("key", "daily_work_hours").execute()
    if resp.data:
        try:
            return float(resp.data[0]["value"])
        except (ValueError, KeyError):
            pass
    return 8.0


def _add_hourly_rate(rate: dict, daily_work_hours: float) -> dict:
    """Fügt das berechnete Feld hourly_rate_eur zum Rate-Dict hinzu."""
    daily = rate.get("daily_rate_eur") or 0
    rate["hourly_rate_eur"] = round(daily / daily_work_hours, 2) if daily_work_hours else 0
    return rate


@router.get("/project-roles")
async def list_project_roles(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    resp = supabase.table("project_roles").select("*").order("name").execute()
    return resp.data or []


@router.post("/project-roles", status_code=201)
async def create_project_role(
    body: ProjectRoleCreate,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    resp = supabase.table("project_roles").insert(body.model_dump()).execute()
    return resp.data[0]


@router.put("/project-roles/{role_id}")
async def update_project_role(
    role_id: str,
    body: ProjectRoleUpdate,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    resp = supabase.table("project_roles").update(data).eq("id", role_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")
    return resp.data[0]


@router.delete("/project-roles/{role_id}", status_code=204)
async def delete_project_role(
    role_id: str,
    current_user: dict = Depends(require_role("admin")),
    supabase=Depends(get_supabase),
):
    supabase.table("project_roles").delete().eq("id", role_id).execute()


# ── Rollenraten je Projekt ───────────────────────────────────────────────────

@router.get("/projects/{project_id}/role-rates")
async def list_project_role_rates(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    daily_work_hours = _get_daily_work_hours(supabase)
    resp = supabase.table("project_role_rates").select(
        "*, project_roles(name, description)"
    ).eq("project_id", project_id).order("created_at").execute()
    return [_add_hourly_rate(r, daily_work_hours) for r in (resp.data or [])]


@router.post("/projects/{project_id}/role-rates", status_code=201)
async def create_project_role_rate(
    project_id: str,
    body: ProjectRoleRateCreate,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    if not body.role_id and not body.custom_role_name:
        raise HTTPException(
            status_code=400,
            detail="Entweder role_id oder custom_role_name muss angegeben werden",
        )
    daily_work_hours = _get_daily_work_hours(supabase)
    data = body.model_dump()
    data["project_id"] = project_id
    resp = supabase.table("project_role_rates").insert(data).execute()
    return _add_hourly_rate(resp.data[0], daily_work_hours)


@router.put("/projects/{project_id}/role-rates/{rate_id}")
async def update_project_role_rate(
    project_id: str,
    rate_id: str,
    body: ProjectRoleRateUpdate,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    daily_work_hours = _get_daily_work_hours(supabase)
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    resp = supabase.table("project_role_rates").update(data).eq("id", rate_id).eq(
        "project_id", project_id
    ).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Rollenrate nicht gefunden")
    return _add_hourly_rate(resp.data[0], daily_work_hours)


@router.delete("/projects/{project_id}/role-rates/{rate_id}", status_code=204)
async def delete_project_role_rate(
    project_id: str,
    rate_id: str,
    current_user: dict = Depends(require_role("admin", "manager")),
    supabase=Depends(get_supabase),
):
    supabase.table("project_role_rates").delete().eq("id", rate_id).eq(
        "project_id", project_id
    ).execute()
