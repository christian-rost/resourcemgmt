"""Main FastAPI application for Ressourcenmanagement."""
import logging
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from supabase import create_client, Client

from .config import CORS_ORIGINS, PORT, supabase_url, supabase_key, admin_user, admin_pw
from .auth import create_access_token, authenticate_user, get_current_user
from .user_storage import create_user, get_user_by_username

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

# ── Supabase client ──────────────────────────────────────────────────────────

_supabase: Optional[Client] = None
if supabase_url and supabase_key:
    _supabase = create_client(supabase_url, supabase_key)
    logger.info("Supabase client initialized")
else:
    logger.warning("Supabase credentials not set - database features disabled")


def get_supabase() -> Client:
    if not _supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    return _supabase


# ── Startup: bootstrap admin ─────────────────────────────────────────────────

@app.on_event("startup")
async def bootstrap_admin():
    if not admin_user or not admin_pw:
        logger.warning("admin_user/admin_pw not set - skipping admin bootstrap")
        return
    if get_user_by_username(admin_user):
        logger.info(f"Admin user '{admin_user}' already exists")
        return
    result = create_user(admin_user, f"{admin_user}@local", admin_pw, role="admin")
    if result:
        logger.info(f"Admin user '{admin_user}' created")
    else:
        logger.error("Failed to create admin user")


# ── Pydantic models (auth) ───────────────────────────────────────────────────

class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


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


# ── Health endpoints ─────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "healthy", "service": "Ressourcenmanagement API"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "database": _supabase is not None}


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
