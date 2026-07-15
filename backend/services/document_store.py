"""Locate uploaded PDFs by doc_id."""

from pathlib import Path

from services.pdf_upload import get_uploads_dir


def find_pdf_for_doc(doc_id: str, uploads_dir_name: str) -> tuple[Path, str]:
    uploads = get_uploads_dir(uploads_dir_name)
    matches = sorted(uploads.glob(f"{doc_id}_*.pdf"))
    if not matches:
        raise FileNotFoundError(f"No PDF found for doc_id={doc_id}")
    path = matches[0]
    filename = path.name[len(doc_id) + 1 :]
    return path, filename
