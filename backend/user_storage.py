"""JSON-file based user storage for Ressourcenmanagement."""
import json
import os
import uuid
import logging
from typing import Optional

from .config import USER_DATA_DIR

logger = logging.getLogger(__name__)

ROLES = ("admin", "manager", "consultant")


def _user_path(user_id: str) -> str:
    return os.path.join(USER_DATA_DIR, f"{user_id}.json")


def _ensure_dir():
    os.makedirs(USER_DATA_DIR, exist_ok=True)


def _load_user(path: str) -> Optional[dict]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _save_user(user: dict):
    _ensure_dir()
    with open(_user_path(user["id"]), "w", encoding="utf-8") as f:
        json.dump(user, f, ensure_ascii=False, indent=2)


def get_user_by_id(user_id: str) -> Optional[dict]:
    return _load_user(_user_path(user_id))


def get_user_by_username(username: str) -> Optional[dict]:
    _ensure_dir()
    for fname in os.listdir(USER_DATA_DIR):
        if not fname.endswith(".json"):
            continue
        user = _load_user(os.path.join(USER_DATA_DIR, fname))
        if user and user.get("username") == username:
            return user
    return None


def get_user_by_email(email: str) -> Optional[dict]:
    _ensure_dir()
    for fname in os.listdir(USER_DATA_DIR):
        if not fname.endswith(".json"):
            continue
        user = _load_user(os.path.join(USER_DATA_DIR, fname))
        if user and user.get("email") == email:
            return user
    return None


def list_users() -> list[dict]:
    _ensure_dir()
    users = []
    for fname in os.listdir(USER_DATA_DIR):
        if not fname.endswith(".json"):
            continue
        user = _load_user(os.path.join(USER_DATA_DIR, fname))
        if user:
            users.append({k: v for k, v in user.items() if k != "password_hash"})
    return sorted(users, key=lambda u: u.get("username", ""))


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

    user = {
        "id": str(uuid.uuid4()),
        "username": username,
        "email": email,
        "display_name": display_name or username,
        "role": role,
        "password_hash": hash_password(password),
        "is_active": True,
    }
    _save_user(user)
    return {k: v for k, v in user.items() if k != "password_hash"}


def update_user(user_id: str, updates: dict) -> Optional[dict]:
    user = get_user_by_id(user_id)
    if not user:
        return None
    allowed = {"email", "display_name", "role", "is_active", "password_hash"}
    for key, val in updates.items():
        if key in allowed:
            user[key] = val
    _save_user(user)
    return {k: v for k, v in user.items() if k != "password_hash"}


def delete_user(user_id: str) -> bool:
    path = _user_path(user_id)
    if os.path.exists(path):
        os.remove(path)
        return True
    return False
