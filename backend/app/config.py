"""
Central configuration — loaded from environment variables.

LEARNING: Production AI services never hardcode API keys or DB URLs.
          `pydantic-settings` / env vars let you swap dev vs prod safely.
"""

import os
from dataclasses import dataclass, field
from functools import lru_cache


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _build_postgres_url(
    *,
    host: str,
    port: str,
    database: str,
    user: str,
    password: str,
) -> str:
    if not all([host, port, database, user]):
        return ""
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


@dataclass
class Settings:
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: list[str] = field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    # Zilliz Cloud (Milvus)
    milvus_address: str = ""
    milvus_token: str = ""
    milvus_collection: str = "pdf_chunks"

    # OpenRouter — Step 9
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o-mini"

    # Embeddings — Step 6
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimension: int = 384

    # Chunking — Step 4
    chunk_size: int = 500
    chunk_overlap: int = 50
    top_k_chunks: int = 5

    uploads_dir: str = "uploads"
    pipeline_max_chunks: int = 120  # cap for free tier / CPU; 0 = unlimited
    memory_db_path: str = "backend/data/memory.db"
    memory_recent_turns: int = 8
    memory_profile_items: int = 6
    use_docker_postgres: bool = False
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "app-agent"
    postgres_user: str = "postgres"
    database_url: str = ""
    database_mode: str = "local"
    web_search_enabled: bool = False
    tavily_api_key: str = ""
    web_search_max_results: int = 5

    # Auth — shared across both platforms
    aman_jwt_secret: str = ""
    aman_session_duration_days: int = 7
    aman_api_key_header: str = "X-Aman-API-Key"
    aman_auth_service_url: str = ""


@lru_cache
def get_settings() -> Settings:
    cors = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    use_docker_postgres = _env_bool("USE_DOCKER_POSTGRES", False)
    postgres_port = os.getenv("POSTGRES_PORT", "5432")
    postgres_db = os.getenv("POSTGRES_DB", "app-agent")
    postgres_user = os.getenv("POSTGRES_USER", "postgres")
    postgres_password = os.getenv("POSTGRES_PASSWORD", "")
    postgres_local_host = os.getenv("POSTGRES_LOCAL_HOST", "localhost")
    postgres_docker_host = os.getenv("POSTGRES_DOCKER_HOST", "postgres")
    database_url_local = os.getenv("DATABASE_URL_LOCAL", "").strip()
    database_url_docker = os.getenv("DATABASE_URL_DOCKER", "").strip()
    legacy_database_url = os.getenv("DATABASE_URL", "").strip()

    if use_docker_postgres:
        resolved_database_url = (
            database_url_docker
            or _build_postgres_url(
                host=postgres_docker_host,
                port=postgres_port,
                database=postgres_db,
                user=postgres_user,
                password=postgres_password,
            )
            or legacy_database_url
        )
        resolved_postgres_host = postgres_docker_host
        database_mode = "docker"
    else:
        resolved_database_url = (
            database_url_local
            or _build_postgres_url(
                host=postgres_local_host,
                port=postgres_port,
                database=postgres_db,
                user=postgres_user,
                password=postgres_password,
            )
            or legacy_database_url
        )
        resolved_postgres_host = postgres_local_host
        database_mode = "local"

    return Settings(
        backend_host=os.getenv("BACKEND_HOST", "0.0.0.0"),
        backend_port=int(os.getenv("BACKEND_PORT", "8000")),
        cors_origins=[o.strip() for o in cors.split(",")],
        milvus_address=os.getenv("MILVUS_ADDRESS", ""),
        milvus_token=os.getenv("MILVUS_TOKEN", ""),
        milvus_collection=os.getenv("MILVUS_COLLECTION_NAME", "pdf_chunks"),
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
        openrouter_model=os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
        embedding_model=os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
        embedding_dimension=int(os.getenv("EMBEDDING_DIMENSION", "384")),
        chunk_size=int(os.getenv("CHUNK_SIZE", "500")),
        chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "50")),
        top_k_chunks=int(os.getenv("TOP_K_CHUNKS", "5")),
        uploads_dir=os.getenv("UPLOADS_DIR", "uploads"),
        pipeline_max_chunks=int(os.getenv("PIPELINE_MAX_CHUNKS", "120")),
        memory_db_path=os.getenv("MEMORY_DB_PATH", "backend/data/memory.db"),
        memory_recent_turns=int(os.getenv("MEMORY_RECENT_TURNS", "8")),
        memory_profile_items=int(os.getenv("MEMORY_PROFILE_ITEMS", "6")),
        use_docker_postgres=use_docker_postgres,
        postgres_host=resolved_postgres_host,
        postgres_port=int(postgres_port),
        postgres_db=postgres_db,
        postgres_user=postgres_user,
        database_url=resolved_database_url,
        database_mode=database_mode,
        web_search_enabled=_env_bool("WEB_SEARCH_ENABLED", False),
        tavily_api_key=os.getenv("TAVILY_API_KEY", ""),
        web_search_max_results=int(os.getenv("WEB_SEARCH_MAX_RESULTS", "5")),
        aman_jwt_secret=os.getenv("AMAN_JWT_SECRET", ""),
        aman_session_duration_days=int(os.getenv("AMAN_SESSION_DURATION_DAYS", "7")),
        aman_api_key_header=os.getenv("AMAN_API_KEY_HEADER", "X-Aman-API-Key"),
        aman_auth_service_url=os.getenv("AMAN_AUTH_SERVICE_URL", ""),
    )
