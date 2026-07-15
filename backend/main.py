"""
FastAPI entrypoint — Context-OS backend.

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


app = FastAPI(
    title="Context-OS API",
    description="Context-OS backend for memory, context, and web intelligence.",
    version="0.1.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(pipeline.router)
app.include_router(chat.router)
app.include_router(amancrawl.router)
app.include_router(dashboard.router)
app.include_router(subscriptions.router)
