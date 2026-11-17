"""Bounded text extraction, executed in a disposable process by the API."""

from __future__ import annotations

import asyncio
import io
import json
import os
import re
import subprocess
import sys
import threading
import zipfile
from pathlib import Path, PurePosixPath

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
    # Page breaks, vertical tabs and record separators separate words; keep a break.
    text = re.sub(r"[\x0b\x0c\x1c-\x1f]", "\n", text)
    text = re.sub(r"[\x00-\x08\x0e-\x1b]", "", text)
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


WORD_NAMESPACES = (
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "http://purl.oclc.org/ooxml/wordprocessingml/main",
)
MC_FALLBACK = "{http://schemas.openxmlformats.org/markup-compatibility/2006}Fallback"
# Wrappers whose content belongs to the surrounding paragraph, row or table:
# content controls, custom XML, smart tags, simple fields, links and bidi runs.
WORD_WRAPPERS = {
    "sdt",
    "sdtContent",
    "customXml",
    "smartTag",
    "fldSimple",
    "hyperlink",
    "dir",
    "bdo",
}


def _word_name(element) -> str:
    """Local WordprocessingML name; empty for other namespaces and comments."""
    tag = element.tag
    if not isinstance(tag, str) or not tag.startswith("{"):
        return ""
    namespace, _, name = tag[1:].partition("}")
    return name if namespace in WORD_NAMESPACES else ""


# A break without type is a line break; page and column breaks add no text.
LINE_BREAKS = {None, "textWrapping"}


def _word_attribute(element, name: str) -> str | None:
    namespace = element.tag[1 : element.tag.index("}")]
    return element.get(f"{{{namespace}}}{name}")


def _run_text(run, parts: list[str]) -> None:
    # Text equivalents as in python-docx.
    for child in run:
        name = _word_name(child)
        if name == "t":
            parts.append(child.text or "")
        elif name in {"tab", "ptab"}:
            parts.append("\t")
        elif name == "noBreakHyphen":
            parts.append("-")
        elif name == "cr" or (name == "br" and _word_attribute(child, "type") in LINE_BREAKS):
            parts.append("\n")


def _inline_text(element, parts: list[str]) -> None:
    for child in element:
        name = _word_name(child)
        if name == "r":
            _run_text(child, parts)
        elif name in WORD_WRAPPERS:
            _inline_text(child, parts)


def _text_boxes(paragraph):
    """Outermost text boxes in a paragraph, without VML fallback duplicates."""
    for box in paragraph.iter(*(f"{{{namespace}}}txbxContent" for namespace in WORD_NAMESPACES)):
        nested = False
        for ancestor in box.iterancestors():
            if ancestor is paragraph:
                break
            if ancestor.tag == MC_FALLBACK or _word_name(ancestor) == "txbxContent":
                nested = True
                break
        if not nested:
            yield box


def _word_items(element, item: str):
    """Rows of a table or cells of a row, also inside content controls."""
    for child in element:
        name = _word_name(child)
        if name == item:
            yield child
        elif name in WORD_WRAPPERS:
            yield from _word_items(child, item)


def _word_blocks(container, blocks: list[str]) -> None:
    """Paragraphs and table rows in document order, as the reader sees them."""
    for child in container:
        name = _word_name(child)
        if name == "p":
            parts: list[str] = []
            _inline_text(child, parts)
            blocks.append("".join(parts))
            for box in _text_boxes(child):
                _word_blocks(box, blocks)
        elif name == "tbl":
            for row in _word_items(child, "tr"):
                cells = []
                for cell in _word_items(row, "tc"):
                    content: list[str] = []
                    _word_blocks(cell, content)
                    cells.append("\n".join(content))
                blocks.append(" | ".join(cells))
        elif name in WORD_WRAPPERS:
            _word_blocks(child, blocks)


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
                for namespace in WORD_NAMESPACES
                for change in ("ins", "del", "moveFrom", "moveTo")
            }
            body = None
            for entry in entries:
                if not entry.filename.startswith("word/") or not entry.filename.endswith(".xml"):
                    continue
                # python-docx's parser resolves no entities. Tracked changes would make
                # the extracted text differ from what the document shows, so refuse them.
                root = parse_xml(archive.read(entry))
                if any(element.tag in revision_tags for element in root.iter()):
                    raise ExtractionError(
                        "Die Word-Datei enthält nicht abgeschlossene Änderungen. "
                        "Nehmen Sie diese in einer Kopie zuerst an oder lehnen Sie sie ab "
                        "und laden Sie die Kopie erneut hoch."
                    )
                if entry.filename == "word/document.xml":
                    body = next((child for child in root if _word_name(child) == "body"), None)
        if body is None:
            raise ExtractionError("Die Datei ist kein gültiges Word-Dokument.")
        blocks: list[str] = []
        _word_blocks(body, blocks)
        # DOCX has no reliable pagination without a layout engine.
        return clean_text("\n\n".join(blocks)), 0
    raise ExtractionError("Unterstützt werden PDF, DOCX, TXT und Markdown.")


_CHILD_ENV = ("PATH", "SYSTEMROOT", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL")
EXTRACTION_TIMEOUT_SECONDS = 25


async def extract_isolated(data: bytes, suffix: str) -> tuple[str, int]:
    """Parse untrusted bytes in a disposable process without configuration or secrets.

    The process runs from a worker thread rather than as an asyncio subprocess: in
    reload mode, Uvicorn uses a selector event loop on Windows, which cannot start
    subprocesses. A timeout or a cancelled request ends the process.
    """
    options = {"creationflags": subprocess.CREATE_NO_WINDOW} if sys.platform == "win32" else {}
    env = {key: os.environ[key] for key in _CHILD_ENV if key in os.environ}
    cancelled = threading.Event()
    started: list[subprocess.Popen] = []

    def run() -> bytes:
        process = subprocess.Popen(
            [sys.executable, "-m", "app.extraction", suffix],
            cwd=Path(__file__).resolve().parent.parent,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            env=env,
            **options,
        )
        started.append(process)
        if cancelled.is_set():
            process.kill()
        try:
            return process.communicate(data, timeout=EXTRACTION_TIMEOUT_SECONDS)[0]
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate()
            raise TimeoutError from None

    try:
        output = await asyncio.to_thread(run)
    except asyncio.CancelledError:
        cancelled.set()
        for process in started:
            process.kill()
        raise
    try:
        result = json.loads(output)
    except (ValueError, UnicodeError):
        raise ExtractionError("Die Datei konnte nicht sicher gelesen werden.") from None
    if "error" in result:
        raise ExtractionError(result["error"])
    return result["text"], result["page_count"]


def _limit_resources() -> None:
    try:
        import resource
    except ImportError:  # Windows
        return
    limit = 2 * 1024**3
    try:
        resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
    except (ValueError, OSError):
        pass


if __name__ == "__main__":
    _limit_resources()
    try:
        text, pages = extract(sys.stdin.buffer.read(12 * 1024 * 1024 + 1), sys.argv[1])
        result = {"text": text, "page_count": pages}
    except ExtractionError as error:
        result = {"error": str(error)}
    except Exception:
        result = {"error": "Die Datei ist beschädigt oder kann nicht gelesen werden."}
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
