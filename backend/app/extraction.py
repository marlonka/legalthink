"""Bounded text extraction, executed in a disposable process by the API."""

from __future__ import annotations

import asyncio
import io
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath

from docx import Document as WordDocument
from docx.oxml import parse_xml
from pypdf import Configuration, PdfReader, apply_configuration
from pypdf.errors import LimitReachedError

MAX_CHARS = 200_000
MAX_PAGES = 120
MAX_PDF_STREAM_BYTES = 4 * 1024 * 1024
MAX_PDF_CONTENT_BYTES = 24 * 1024 * 1024

# Apply these limits only while reading PDFs. A small upload can otherwise expand
# beyond its file size before the text-length limit has a chance to run.
PDF_CONFIGURATION = Configuration(
    maximum_declared_stream_length=MAX_PDF_STREAM_BYTES,
    array_based_stream_maximum_output_length=MAX_PDF_STREAM_BYTES,
    zlib_maximum_output_length=MAX_PDF_STREAM_BYTES,
    zlib_maximum_recovery_input_length=MAX_PDF_STREAM_BYTES,
    lzw_maximum_output_length=MAX_PDF_STREAM_BYTES,
    run_length_maximum_output_length=MAX_PDF_STREAM_BYTES,
    jbig2_maximum_output_length=MAX_PDF_STREAM_BYTES,
    image_maximum_buffer_size=MAX_PDF_STREAM_BYTES,
    page_tree_maximum_entries=2000,
    page_tree_maximum_depth=32,
    xform_maximum_invocations_per_extraction=1000,
    jbig2dec_binary=None,
)


class ExtractionError(ValueError):
    pass


def safe_filename(name: str | None) -> str:
    # Names are presentation metadata only; uploaded bytes are never written under this name.
    name = PurePosixPath((name or "Dokument.txt").replace("\\", "/")).name
    name = re.sub(r"[\x00-\x1f\x7f<>:\"|?*]", "_", name).strip(" .")
    suffix = PurePosixPath(name).suffix
    if len(name) > 180 and 0 < len(suffix) < 180:
        name = name[: 180 - len(suffix)] + suffix
    return name[:180] or "Dokument.txt"


def clean_text(text: str) -> str:
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if len(text) > MAX_CHARS:
        raise ExtractionError(
            "Das Dokument ist zu lang. Bitte auf maximal 200.000 Zeichen aufteilen."
        )
    if not text:
        raise ExtractionError("Das Dokument enthält keinen lesbaren Text.")
    return text


def extract_pdf(data: bytes) -> tuple[str, int]:
    if not data.startswith(b"%PDF-"):
        raise ExtractionError("Die Datei ist kein gültiges PDF.")
    with apply_configuration(PDF_CONFIGURATION):
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ExtractionError(
                "Das PDF ist verschlüsselt. Bitte eine entsperrte Kopie hochladen."
            )
        if len(reader.pages) > MAX_PAGES:
            raise ExtractionError("PDFs dürfen maximal 120 Seiten enthalten.")
        pages = []
        total = 0
        content_bytes = 0
        blank_pages = []
        for number, page in enumerate(reader.pages, 1):
            contents = page.get_contents()
            page_bytes = len(contents.get_data()) if contents is not None else 0
            content_bytes += page_bytes
            if page_bytes > MAX_PDF_STREAM_BYTES or content_bytes > MAX_PDF_CONTENT_BYTES:
                raise ExtractionError(
                    "Die PDF-Inhalte sind zu komplex. Bitte eine vereinfachte "
                    "Version oder eine Text-/Word-Datei hochladen."
                )
            text = (page.extract_text() or "").strip()
            if not text:
                blank_pages.append(number)
            total += len(text)
            if total > MAX_CHARS:
                raise ExtractionError("Das PDF ist zu lang. Bitte in kleinere Dokumente aufteilen.")
            pages.append(f"[Seite {number}]\n{text}")
        if len(blank_pages) == len(reader.pages):
            raise ExtractionError(
                "Dieses PDF enthält keinen auslesbaren Text. Bitte zuerst OCR "
                "anwenden oder eine Text-/Word-Datei hochladen."
            )
        # Do not silently analyze partially scanned files as if the whole document was read.
        if blank_pages:
            numbers = ", ".join(map(str, blank_pages[:12]))
            raise ExtractionError(
                f"PDF-Seiten ohne auslesbaren Text: {numbers}. Bitte OCR "
                "anwenden oder leere Seiten entfernen und erneut hochladen."
            )
        return clean_text("\n\n".join(pages)), len(pages)


def extract(data: bytes, suffix: str) -> tuple[str, int]:
    if not data:
        raise ExtractionError("Die Datei ist leer.")
    if suffix in {".txt", ".md"}:
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ExtractionError("Textdateien bitte als UTF-8 speichern.") from None
        return clean_text(text), 1
    if suffix == ".pdf":
        try:
            return extract_pdf(data)
        except LimitReachedError:
            raise ExtractionError(
                "Die PDF-Inhalte sind zu komplex. Bitte eine vereinfachte "
                "Version oder eine Text-/Word-Datei hochladen."
            ) from None
    if suffix == ".docx":
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > 1000 or sum(e.file_size for e in entries) > 40 * 1024 * 1024:
                raise ExtractionError("Die Word-Datei ist nach dem Entpacken zu groß.")
            if any(e.file_size > max(e.compress_size, 1) * 250 for e in entries):
                raise ExtractionError("Die Word-Datei hat eine ungewöhnlich hohe Kompression.")
            if "word/document.xml" not in archive.namelist():
                raise ExtractionError("Die Datei ist kein gültiges Word-Dokument.")
            revision_tags = {
                f"{{{namespace}}}{change}"
                for namespace in (
                    "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
                    "http://purl.oclc.org/ooxml/wordprocessingml/main",
                )
                for change in ("ins", "del", "moveFrom", "moveTo")
            }
            for entry in entries:
                if not entry.filename.startswith("word/") or not entry.filename.endswith(".xml"):
                    continue
                # Reuse python-docx's parser with entity resolution disabled. The
                # paragraph API otherwise silently omits tracked text changes.
                root = parse_xml(archive.read(entry))
                if any(element.tag in revision_tags for element in root.iter()):
                    raise ExtractionError(
                        "Die Word-Datei enthält nicht abgeschlossene Änderungen. "
                        "Nehmen Sie diese in einer Kopie zuerst an oder lehnen Sie sie ab "
                        "und laden Sie die Kopie erneut hoch."
                    )
        doc = WordDocument(io.BytesIO(data))
        paragraphs = []
        # iter_inner_content retains the order of paragraphs and tables.
        for item in doc.iter_inner_content():
            if hasattr(item, "text"):
                paragraphs.append(item.text)
            else:
                for row in item.rows:
                    paragraphs.append(" | ".join(cell.text for cell in row.cells))
        text = clean_text("\n\n".join(paragraphs))
        # DOCX has no reliable pagination without a layout engine.
        return text, 0
    raise ExtractionError("Unterstützt werden PDF, DOCX, TXT und Markdown.")


async def extract_isolated(data: bytes, suffix: str) -> tuple[str, int]:
    options = {"creationflags": subprocess.CREATE_NO_WINDOW} if sys.platform == "win32" else {}
    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "app.extraction",
        suffix,
        cwd=Path(__file__).resolve().parent.parent,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
        **options,
    )
    try:
        output, _ = await asyncio.wait_for(process.communicate(data), timeout=25)
    except (TimeoutError, asyncio.CancelledError):
        if process.returncode is None:
            process.kill()
        await process.wait()
        raise
    try:
        result = json.loads(output)
    except (ValueError, UnicodeError):
        raise ExtractionError("Die Datei konnte nicht sicher gelesen werden.") from None
    if "error" in result:
        raise ExtractionError(result["error"])
    return result["text"], result["page_count"]


if __name__ == "__main__":
    try:
        text, pages = extract(sys.stdin.buffer.read(12 * 1024 * 1024 + 1), sys.argv[1])
        result = {"text": text, "page_count": pages}
    except ExtractionError as error:
        result = {"error": str(error)}
    except Exception:
        result = {"error": "Die Datei ist beschädigt oder kann nicht gelesen werden."}
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
