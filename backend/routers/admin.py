"""Admin router: User management, app configuration."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator

from ..auth import get_current_user, require_role, hash_password
from ..user_storage import (
    list_users, get_user_by_id, create_user, update_user, delete_user, ROLES
)
from ..main import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["Admin"])

HOURS_PER_DAY_KEY = "hours_per_day"


# ── Pydantic Models ─────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "consultant"
    display_name: Optional[str] = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be between 3 and 32 characters")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ROLES:
            raise ValueError(f"Role must be one of {ROLES}")
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ROLES:
            raise ValueError(f"Role must be one of {ROLES}")
        return v


class AppConfigUpdate(BaseModel):
    hours_per_day: Optional[float] = None
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    dark_color: Optional[str] = None


# ── User Management ──────────────────────────────────────────────────────────

@router.get("/users")
async def get_users(current_user: dict = Depends(require_role("admin", "manager"))):
    return list_users()


@router.post("/users", status_code=201)
async def create_new_user(
    body: UserCreate,
    current_user: dict = Depends(require_role("admin")),
):
    user = create_user(
        username=body.username,
        email=body.email,
        password=body.password,
        role=body.role,
        display_name=body.display_name or body.username,
    )
    if not user:
        raise HTTPException(status_code=409, detail="Username or email already exists")
    return user


@router.put("/users/{user_id}")
async def update_existing_user(
    user_id: str,
    body: UserUpdate,
    current_user: dict = Depends(require_role("admin")),
):
    updates = {}
    if body.email is not None:
        updates["email"] = body.email
    if body.display_name is not None:
        updates["display_name"] = body.display_name
    if body.role is not None:
        updates["role"] = body.role
    if body.is_active is not None:
        updates["is_active"] = body.is_active
    if body.password is not None:
        if len(body.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        updates["password_hash"] = hash_password(body.password)

    user = update_user(user_id, updates)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/users/{user_id}", status_code=204)
async def delete_existing_user(
    user_id: str,
    current_user: dict = Depends(require_role("admin")),
):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    if not delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")


# ── App Configuration ─────────────────────────────────────────────────────────

@router.get("/config")
async def get_config(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    resp = supabase.table("app_config").select("*").execute()
    return {row["key"]: row["value"] for row in (resp.data or [])}


@router.put("/config")
async def update_config(
    body: AppConfigUpdate,
    current_user: dict = Depends(require_role("admin")),
    supabase=Depends(get_supabase),
):
    mapping = {
        "hours_per_day": body.hours_per_day,
        "company_name": body.company_name,
        "logo_url": body.logo_url,
        "primary_color": body.primary_color,
        "dark_color": body.dark_color,
    }
    for key, val in mapping.items():
        if val is not None:
            supabase.table("app_config").upsert(
                {"key": key, "value": str(val)},
                on_conflict="key"
            ).execute()

    resp = supabase.table("app_config").select("*").execute()
    return {row["key"]: row["value"] for row in (resp.data or [])}
