"""
Upload API routes — Step 2.

POST /api/upload — accept multipart PDF, store under backend/uploads/
"""

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import get_settings
from services.pdf_upload import save_pdf_upload

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload a PDF for the RAG pipeline.

    Returns metadata shown in the UI: filename, size, pages, timestamp, doc_id.
    """
    settings = get_settings()

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    # Some browsers omit content_type; extension + PyMuPDF validate the file.
    content_type = (file.content_type or "").lower()
    if content_type and "pdf" not in content_type:
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        raw = await file.read()
        result = await save_pdf_upload(
            file_bytes=raw,
            original_filename=file.filename,
            uploads_dir_name=settings.uploads_dir,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Upload failed") from exc

    return {
        "doc_id": result.doc_id,
        "filename": result.filename,
        "size_bytes": result.size_bytes,
        "size_human": _format_bytes(result.size_bytes),
        "page_count": result.page_count,
        "uploaded_at": result.uploaded_at,
        "stored_path": result.stored_path,
        "pipeline_step": "upload",
    }


def _format_bytes(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / (1024 * 1024):.1f} MB"
