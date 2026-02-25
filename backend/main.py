"""Main FastAPI application for Ressourcenmanagement."""
import logging

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .config import CORS_ORIGINS, PORT, admin_user, admin_pw
from .database import get_db        # Supabase-Singleton
from .auth import create_access_token, authenticate_user, get_current_user, verify_password, hash_password
from .user_storage import create_user, get_user_by_username, update_user

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Ressourcenmanagement API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Alias damit bestehende Router-Imports (from ..main import get_supabase) weiterhin funktionieren
get_supabase = get_db


# ── Startup: bootstrap admin ─────────────────────────────────────────────────

@app.on_event("startup")
async def bootstrap_admin():
    if not admin_user or not admin_pw:
        logger.warning("admin_user/admin_pw not set – skipping admin bootstrap")
        return
    try:
        if get_user_by_username(admin_user):
            logger.info(f"Admin user '{admin_user}' already exists")
            return
        result = create_user(admin_user, f"{admin_user}@local", admin_pw, role="admin")
        if result:
            logger.info(f"Admin user '{admin_user}' created")
        else:
            logger.error("Failed to create admin user")
    except Exception as e:
        logger.error(f"Admin bootstrap failed: {e}")


# ── Pydantic models (auth) ───────────────────────────────────────────────────

class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    display_name: str = ""
    role: str = "consultant"
    is_active: bool = True


# ── Auth endpoints ───────────────────────────────────────────────────────────

@app.post("/api/auth/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: UserLogin):
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated")
    access_token = create_access_token(data={"sub": user["id"]})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.put("/api/auth/password")
async def change_password(
    body: PasswordChange,
    current_user: dict = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Aktuelles Passwort ist falsch")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Neues Passwort muss mindestens 8 Zeichen haben")
    update_user(current_user["id"], {"password_hash": hash_password(body.new_password)})
    return {"detail": "Passwort geändert"}


# ── Health endpoints ─────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "healthy", "service": "Ressourcenmanagement API"}


@app.get("/api/health")
async def health_check():
    from .database import get_client
    return {"status": "healthy", "database": get_client() is not None}


# ── Register routers ─────────────────────────────────────────────────────────

from .routers import stammdaten, zeiterfassung, zeitplanung, admin, reports

app.include_router(stammdaten.router)
app.include_router(zeiterfassung.router)
app.include_router(zeitplanung.router)
app.include_router(admin.router)
app.include_router(reports.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
