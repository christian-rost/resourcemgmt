"""Supabase client singleton – importierbar von allen Modulen."""
import logging
from typing import Optional
from fastapi import HTTPException
from supabase import create_client, Client

from .config import supabase_url, supabase_key

logger = logging.getLogger(__name__)

_client: Optional[Client] = None

if supabase_url and supabase_key:
    _client = create_client(supabase_url, supabase_key)
    logger.info("Supabase client initialized")
else:
    logger.warning("Supabase credentials not set – database features disabled")


def get_db() -> Client:
    """FastAPI dependency: liefert den Supabase-Client oder 503."""
    if not _client:
        raise HTTPException(status_code=503, detail="Database not configured")
    return _client


# Direkter Zugriff ohne FastAPI-Dependency (für user_storage etc.)
def get_client() -> Optional[Client]:
    return _client
