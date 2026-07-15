"""Text extraction for supported Kontext artifact formats."""

from __future__ import annotations

import csv
import json
import time
import zipfile
from io import StringIO
from pathlib import Path
from xml.etree import ElementTree

from bs4 import BeautifulSoup
from services.pdf_pages import extract_pages as extract_pdf_pages
from services.text_normalize import normalize_pdf_text

TEXT_EXTENSIONS = {
    ".txt", ".md", ".markdown", ".py", ".js", ".jsx", ".ts", ".tsx", ".css",
    ".scss", ".sql", ".yaml", ".yml", ".xml", ".toml", ".ini", ".log", ".java",
    ".go", ".rs", ".c", ".h", ".cpp", ".hpp", ".sh", ".ps1",
}


def extract_artifact_pages(path: Path) -> list[dict]:
    extension = path.suffix.lower()
    if extension == ".pdf":
        return extract_pdf_pages(path)
    if extension == ".docx":
        with zipfile.ZipFile(path) as archive:
            document_xml = archive.read("word/document.xml")
        root = ElementTree.fromstring(document_xml)
        namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        paragraphs = []
        for paragraph in root.iter(f"{namespace}p"):
            value = "".join(node.text or "" for node in paragraph.iter(f"{namespace}t")).strip()
            if value:
                paragraphs.append(value)
        text = "\n\n".join(paragraphs)
    elif extension in {".html", ".htm"}:
        text = BeautifulSoup(path.read_text(encoding="utf-8", errors="replace"), "lxml").get_text("\n", strip=True)
    elif extension == ".json":
        raw = json.loads(path.read_text(encoding="utf-8", errors="replace"))
        text = json.dumps(raw, indent=2, ensure_ascii=False)
    elif extension == ".csv":
        rows = csv.reader(StringIO(path.read_text(encoding="utf-8-sig", errors="replace")))
        text = "\n".join(" | ".join(cell.strip() for cell in row) for row in rows)
    elif extension in TEXT_EXTENSIONS:
        text = path.read_text(encoding="utf-8", errors="replace")
    else:
        raise ValueError(f"Extraction is not available for {extension or 'this file type'}")

    text = normalize_pdf_text(text)
    return [{"page": 1, "text": text, "char_count": len(text), "preview": text[:280] + ("…" if len(text) > 280 else "")}]


def extract_artifact_text(path: Path) -> dict:
    start = time.perf_counter()
    pages = extract_artifact_pages(path)
    return {
        "page_count": len(pages),
        "total_chars": sum(page["char_count"] for page in pages),
        "pages": pages,
        "duration_ms": round((time.perf_counter() - start) * 1000, 2),
    }
