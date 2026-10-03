"""Single-workspace SQLite storage. Content is local, unencrypted and never logged."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any

TABLES = {"documents", "analyses", "playbooks"}


class ProtectedDocumentError(ValueError):
    pass


class Store:
    def __init__(self, data_dir: Path):
        data_dir.mkdir(parents=True, exist_ok=True)
        self.path = data_dir / "workspace.sqlite3"
        with self.connection() as db:
            db.execute("PRAGMA journal_mode=WAL")
            for table in TABLES:
                db.execute(
                    f"CREATE TABLE IF NOT EXISTS {table} "
                    "(id TEXT PRIMARY KEY, body TEXT NOT NULL, "
                    "created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))"
                )
            db.execute(
                "CREATE TABLE IF NOT EXISTS document_originals "
                "(document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE, "
                "content BLOB NOT NULL)"
            )

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.execute("PRAGMA secure_delete=ON")
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def put(self, table: str, value: dict[str, Any]) -> None:
        assert table in TABLES
        with self.connection() as db:
            db.execute(
                f"INSERT INTO {table} (id,body) VALUES (?,?) "
                "ON CONFLICT(id) DO UPDATE SET body=excluded.body",
                (value["id"], json.dumps(value, ensure_ascii=False)),
            )

    def update(self, table: str, value: dict[str, Any]) -> bool:
        """Replace an existing record without resurrecting concurrently deleted content."""
        assert table in TABLES
        with self.connection() as db:
            return (
                db.execute(
                    f"UPDATE {table} SET body=? WHERE id=?",
                    (json.dumps(value, ensure_ascii=False), value["id"]),
                ).rowcount
                > 0
            )

    def save_document(self, document: dict[str, Any], original: bytes | None = None) -> None:
        with self.connection() as db:
            db.execute(
                "INSERT INTO documents (id,body) VALUES (?,?)",
                (document["id"], json.dumps(document, ensure_ascii=False)),
            )
            if original is not None:
                db.execute(
                    "INSERT INTO document_originals (document_id,content) VALUES (?,?)",
                    (document["id"], original),
                )

    def attach_original(self, document_id: str, original: bytes) -> dict[str, Any] | None:
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT body FROM documents WHERE id=?", (document_id,)).fetchone()
            if row is None:
                return None
            if db.execute(
                "SELECT 1 FROM document_originals WHERE document_id=?", (document_id,)
            ).fetchone():
                raise FileExistsError("Document original already stored")
            document = json.loads(row[0])
            document["original_available"] = True
            db.execute(
                "UPDATE documents SET body=? WHERE id=?",
                (json.dumps(document, ensure_ascii=False), document_id),
            )
            db.execute(
                "INSERT INTO document_originals (document_id,content) VALUES (?,?)",
                (document_id, original),
            )
            return document

    def original(self, document_id: str) -> bytes | None:
        with self.connection() as db:
            row = db.execute(
                "SELECT content FROM document_originals WHERE document_id=?", (document_id,)
            ).fetchone()
        return row[0] if row else None

    def save_analysis(
        self, analysis: dict[str, Any], pasted_document: dict[str, Any] | None = None
    ) -> None:
        """Commit a completed analysis and its optional pasted source together."""
        with self.connection() as db:
            if pasted_document is not None:
                db.execute(
                    "INSERT INTO documents (id,body) VALUES (?,?)",
                    (pasted_document["id"], json.dumps(pasted_document, ensure_ascii=False)),
                )
            db.execute(
                "INSERT INTO analyses (id,body) VALUES (?,?)",
                (analysis["id"], json.dumps(analysis, ensure_ascii=False)),
            )

    def get(self, table: str, item_id: str) -> dict[str, Any] | None:
        assert table in TABLES
        with self.connection() as db:
            row = db.execute(f"SELECT body FROM {table} WHERE id=?", (item_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def list(self, table: str) -> list[dict[str, Any]]:
        assert table in TABLES
        with self.connection() as db:
            rows = db.execute(f"SELECT body FROM {table} ORDER BY created_at DESC, rowid DESC")
            return [json.loads(row[0]) for row in rows]

    def delete_documents(self, document_ids: list[str]) -> None:
        # Delete the confirmed selection atomically; newer uploads stay untouched.
        with self.connection() as db:
            db.executemany(
                "DELETE FROM documents WHERE id=? AND COALESCE(json_extract(body,'$.is_demo'),0)=0",
                [(item,) for item in document_ids],
            )

    def delete(self, table: str, item_id: str) -> bool:
        assert table in TABLES
        with self.connection() as db:
            if table == "documents":
                db.execute("BEGIN IMMEDIATE")
                row = db.execute("SELECT body FROM documents WHERE id=?", (item_id,)).fetchone()
                if row and json.loads(row[0]).get("is_demo"):
                    raise ProtectedDocumentError("Systembeispiele können nicht gelöscht werden.")
            deleted = db.execute(f"DELETE FROM {table} WHERE id=?", (item_id,)).rowcount > 0
        return deleted
