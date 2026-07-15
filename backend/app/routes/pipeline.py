"""Pipeline visualization — SSE stream for all processing steps."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.config import get_settings
from services.pipeline_runner import run_pipeline_visualization

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.post("/{doc_id}/visualize")
async def visualize_pipeline(doc_id: str):
    """
    Run extract → chunk → tokenize → embed → Milvus and stream step events.
    Frontend uses this for the "Visualize full pipeline" button.
    """
    if not doc_id.strip():
        raise HTTPException(status_code=400, detail="Missing doc_id")

    settings = get_settings()
    return StreamingResponse(
        run_pipeline_visualization(doc_id, settings),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
