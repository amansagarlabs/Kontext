"""
FastAPI entrypoint — Kontext backend.

WHY this file exists:
  Single place to wire routes, CORS, and lifespan hooks.
  Production apps keep `main.py` thin and push logic into `app/` and `services/`.
"""

from contextlib import asynccontextmanager

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import auth, chat, health, pipeline, upload, amancrawl, dashboard, subscriptions
from services.memory_store import init_memory_store

# Project root: my-ai-app/.env (one level above backend/)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env")
load_dotenv()  # optional backend/.env override


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown — Step 7 will connect Milvus here."""
    settings = get_settings()
    app.state.settings = settings
    init_memory_store(settings)
    yield


api = FastAPI(
    title="Kontext API",
    description="Kontext backend for memory, context, and web intelligence.",
    version="0.1.0",
    lifespan=lifespan,
)

api.include_router(health.router)
api.include_router(auth.router)
api.include_router(upload.router)
api.include_router(pipeline.router)
api.include_router(chat.router)
api.include_router(amancrawl.router)
api.include_router(dashboard.router)
api.include_router(subscriptions.router)

settings = get_settings()
# Keep CORS outermost so unexpected server errors still return browser-readable headers.
app = CORSMiddleware(
    app=api,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
