"""Supabase-basierter User-Storage für Ressourcenmanagement."""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

ROLES = ("admin", "manager", "consultant")


def _db():
    from .database import get_client
    client = get_client()
    if not client:
        raise RuntimeError("Supabase client not initialized")
    return client


def get_user_by_id(user_id: str) -> Optional[dict]:
    try:
        resp = _db().table("users").select("*").eq("id", user_id).maybe_single().execute()
        return resp.data
    except Exception as e:
        logger.error(f"get_user_by_id({user_id}): {e}")
        return None


def get_user_by_username(username: str) -> Optional[dict]:
    try:
        resp = _db().table("users").select("*").eq("username", username).maybe_single().execute()
        return resp.data
    except Exception as e:
        logger.error(f"get_user_by_username({username}): {e}")
        return None


def get_user_by_email(email: str) -> Optional[dict]:
    try:
        resp = _db().table("users").select("*").eq("email", email).maybe_single().execute()
        return resp.data
    except Exception as e:
        logger.error(f"get_user_by_email({email}): {e}")
        return None


def list_users() -> list[dict]:
    try:
        resp = _db().table("users").select(
            "id, username, email, display_name, role, is_active, created_at"
        ).order("username").execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"list_users: {e}")
        return []


def create_user(
    username: str,
    email: str,
    password: str,
    role: str = "consultant",
    display_name: str = "",
) -> Optional[dict]:
    from .auth import hash_password

    if role not in ROLES:
        role = "consultant"

    if get_user_by_username(username) or get_user_by_email(email):
        return None

    try:
        data = {
            "username": username,
            "email": email,
            "display_name": display_name or username,
            "role": role,
            "password_hash": hash_password(password),
            "is_active": True,
        }
        resp = _db().table("users").insert(data).execute()
        user = resp.data[0]
        return {k: v for k, v in user.items() if k != "password_hash"}
    except Exception as e:
        logger.error(f"create_user({username}): {e}")
        return None


def update_user(user_id: str, updates: dict) -> Optional[dict]:
    try:
        resp = _db().table("users").update(updates).eq("id", user_id).execute()
        if not resp.data:
            return None
        user = resp.data[0]
        return {k: v for k, v in user.items() if k != "password_hash"}
    except Exception as e:
        logger.error(f"update_user({user_id}): {e}")
        return None


def delete_user(user_id: str) -> bool:
    try:
        _db().table("users").delete().eq("id", user_id).execute()
        return True
    except Exception as e:
        logger.error(f"delete_user({user_id}): {e}")
        return False
