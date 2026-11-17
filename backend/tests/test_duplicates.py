"""Duplicate search: only identical content is grouped; copies only move to the trash."""

import os
import stat
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Send2Trash's freedesktop variant reads XDG_DATA_HOME when first imported.
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "xdg"))
    with TestClient(
        create_app(Settings(data_dir=tmp_path / "data")),
        base_url="http://localhost",
        client=("127.0.0.1", 12345),
    ) as client:
        yield client


def write(path: Path, data: bytes, modified: int | None = None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    if modified is not None:
        os.utime(path, (modified, modified))
    return path


def scan(client, folder: Path) -> dict:
    started = client.post("/api/duplicates/scan", json={"path": f'"{folder}"'})
    assert started.status_code == 202, started.text
    for _ in range(400):
        result = client.get("/api/duplicates/scan").json()
        if result["state"] != "running":
            assert result["state"] == "completed", result
            return result
        time.sleep(0.025)
    raise AssertionError("The scan did not finish.")


def groups(result: dict) -> list[list[str]]:
    return [[file["relative_path"] for file in group["files"]] for group in result["groups"]]


def in_trash(path: Path, data: bytes, tmp_path: Path) -> bool:
    if sys.platform == "win32":
        # The shell keeps recycled files as $R… under the drive's $Recycle.Bin\<SID>.
        recycled = Path(path.anchor, "$Recycle.Bin").glob(f"*/$R*{path.suffix}")
        return any(item.is_file() and item.read_bytes() == data for item in recycled)
    if sys.platform == "darwin":
        return not path.exists()
    trash = tmp_path / "xdg" / "Trash"
    return (trash / "files" / path.name).read_bytes() == data and (
        trash / "info" / f"{path.name}.trashinfo"
    ).is_file()


def test_scan_groups_identical_content_only(client, tmp_path):
    root = tmp_path / "Mandate"
    contract = os.urandom(300_000)
    # Same size, head and tail: only the full comparison can tell them apart.
    lookalike = bytearray(contract)
    lookalike[150_000] ^= 1
    original = write(root / "2026-014" / "Vertrag.pdf", contract)
    write(root / "Downloads" / "Vertrag (1).pdf", contract)
    write(root / "Entwurf" / "Vertrag.pdf", bytes(lookalike))
    write(root / "Notizen" / "Telefonat.txt", b"Rueckruf vereinbart.")
    write(root / "Notizen" / "Telefonat Kopie.txt", b"Rueckruf vereinbart.")
    write(root / "leer-1.txt", b"")
    write(root / "leer-2.txt", b"")
    # Hidden folders, Office lock files and macOS packages are not user documents.
    write(root / ".Archiv" / "Vertrag.pdf", contract)
    write(root / "Fotos.photoslibrary" / "Vertrag.pdf", contract)
    write(root / "~$Vertrag.docx", b"lock")
    write(root / "Notizen" / "~$Vertrag.docx", b"lock")
    os.link(original, root / "2026-014" / "Vertrag-Verknuepfung.pdf")
    if sys.platform != "win32":
        os.symlink(original, root / "Vertrag-Link.pdf")
        os.symlink(root, root / "Schleife")
    if sys.platform == "win32":
        import ctypes

        hidden = write(root / "Kopien" / "Vertrag-versteckt.pdf", contract)
        online = write(root / "Kopien" / "Vertrag-online.pdf", contract)
        kernel32 = ctypes.WinDLL("kernel32")
        assert kernel32.SetFileAttributesW(str(hidden), stat.FILE_ATTRIBUTE_HIDDEN)
        # OneDrive marks online-only files like this; reading them would download them.
        assert kernel32.SetFileAttributesW(str(online), stat.FILE_ATTRIBUTE_OFFLINE)
    if sys.platform == "darwin":
        hidden = write(root / "Kopien" / "Vertrag-versteckt.pdf", contract)
        os.chflags(hidden, stat.UF_HIDDEN)

    result = scan(client, root)

    assert sorted(map(sorted, groups(result))) == [
        sorted(
            [os.path.join("2026-014", "Vertrag.pdf"), os.path.join("Downloads", "Vertrag (1).pdf")]
        ),
        sorted(
            [
                os.path.join("Notizen", "Telefonat Kopie.txt"),
                os.path.join("Notizen", "Telefonat.txt"),
            ]
        ),
    ]
    assert result["duplicate_count"] == 2
    assert result["duplicate_bytes"] == len(contract) + len(b"Rueckruf vereinbart.")
    assert result["cloud_only"] == (1 if sys.platform == "win32" else 0)
    assert result["unreadable"] == 0


def test_trash_moves_only_rechecked_copies_and_keeps_one_per_group(client, tmp_path):
    root = tmp_path / "Ablage"
    contract = os.urandom(200_000)
    letter = os.urandom(50_000)
    first = write(root / "Vertrag.pdf", contract, modified=1_700_000_000)
    second = write(root / "Kopie" / "Vertrag.pdf", contract, modified=1_700_000_100)
    third = write(root / "Kopie" / "Vertrag (2).pdf", contract, modified=1_700_000_200)
    kept_letter = write(root / "Schreiben.docx", letter, modified=1_700_000_000)
    copied_letter = write(root / "Kopie" / "Schreiben.docx", letter, modified=1_700_000_100)

    result = scan(client, root)
    files = {file["path"]: file["id"] for group in result["groups"] for file in group["files"]}
    # The oldest file leads its group; "Neuere Kopien auswählen" keeps it.
    assert [group["files"][0]["path"] for group in result["groups"]] == [
        str(first),
        str(kept_letter),
    ]

    def trash(*paths: Path, scan_id: str = result["id"]):
        return client.post(
            "/api/duplicates/trash",
            json={"scan_id": scan_id, "file_ids": [files[str(path)] for path in paths]},
        )

    every_copy = trash(kept_letter, copied_letter)
    assert every_copy.status_code == 422
    assert trash(second, scan_id="outdated").status_code == 409
    assert kept_letter.exists() and copied_letter.exists()

    # Content can change between scan and action: neither a changed copy nor a copy
    # whose kept counterpart changed may move.
    changed = bytearray(contract)
    changed[100_000] ^= 1
    third.write_bytes(bytes(changed))
    kept_letter.write_bytes(os.urandom(len(letter)))
    report = trash(second, third, copied_letter)
    assert report.status_code == 200, report.text
    body = report.json()
    assert body["trashed"] == 1
    assert {failure["path"]: failure["reason"] for failure in body["failed"]} == {
        str(third): "Seit der Suche geändert oder entfernt.",
        str(copied_letter): "Keine unveränderte Kopie dieser Datei mehr vorhanden.",
    }
    assert not second.exists() and in_trash(second, contract, tmp_path)
    assert first.read_bytes() == contract
    assert third.read_bytes() == bytes(changed) and copied_letter.read_bytes() == letter
    remaining = groups(body["scan"])
    assert os.path.join("Kopie", "Vertrag.pdf") not in sum(remaining, [])


@pytest.mark.skipif(sys.platform != "win32", reason="Windows Recycle Bin rules")
def test_windows_never_recycles_where_the_shell_would_delete_permanently(tmp_path):
    import subprocess
    import winreg

    from app import local_files

    local = write(tmp_path / "Vertrag.pdf", b"Vertragstext")
    drive, rest = os.path.splitdrive(str(local))
    share = rf"\\localhost\{drive[0]}${rest}"
    assert local_files.windows_recycle_problem(str(local), 12)[0] is None
    assert local_files.windows_recycle_problem(share, 12)[0] is not None
    assert local_files.windows_recycle_problem(str(local), 1 << 50)[0] is not None

    # Second barrier: with the bin switched off, the shell itself would delete the file
    # permanently. A fresh process reads the changed setting.
    guid, _ = local_files.windows_volume(str(local))
    key = local_files.BIN_SETTINGS + r"\Volume" + "\\" + guid
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key) as handle:
        try:
            previous = winreg.QueryValueEx(handle, "NukeOnDelete")
        except OSError:
            previous = None
        winreg.SetValueEx(handle, "NukeOnDelete", 0, winreg.REG_DWORD, 1)
        try:
            assert local_files.windows_recycle_problem(str(local), 12)[0] is not None
            refused = subprocess.run(
                [
                    sys.executable,
                    "-c",
                    "import sys; from app.local_files import windows_recycle; "
                    "print(windows_recycle(sys.argv[1]) or 'recycled')",
                    str(local),
                ],
                cwd=Path(__file__).resolve().parent.parent,
                capture_output=True,
                text=True,
                timeout=120,
            )
            assert refused.returncode == 0, refused.stderr
            assert refused.stdout.strip() != "recycled"
            assert local.read_bytes() == b"Vertragstext"
        finally:
            if previous is None:
                winreg.DeleteValue(handle, "NukeOnDelete")
            else:
                winreg.SetValueEx(handle, "NukeOnDelete", 0, previous[1], previous[0])
