"""Find files with identical content in a local folder.

Files are compared in stages, so most of them are read only partially: equal size,
then equal head and tail samples, then an equal BLAKE2b digest of the whole content.
Hard links to one file count once. Hidden and system files, links, macOS packages and
cloud placeholders are skipped; online-only files are never opened, so a scan does not
download them. Before a copy moves to the trash, it and a kept copy are read again;
the last copy of a group never moves.
"""

from __future__ import annotations

import errno
import hashlib
import logging
import os
import stat
import threading
import time
from collections import defaultdict
from collections.abc import Callable, Hashable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from .local_files import (
    access_message,
    cloud_only,
    encodable,
    folder_path,
    hidden,
    keep_cloud_files_online,
    link,
    move_to_trash,
    package,
    same_file,
)

logger = logging.getLogger("legalthink")

SAMPLE_BYTES = 4 * 1024
# Files up to this size are read completely while sampling.
SMALL_FILE_BYTES = 4 * SAMPLE_BYTES
CHUNK_BYTES = 1024 * 1024
MAX_FILES = 1_000_000
MAX_GROUPS = 1_000
MAX_READERS = 8
PROBE_SECONDS = 0.4
# Another reader stays only if it raises throughput by at least this factor.
MIN_GAIN = 1.1
OPEN_FLAGS = os.O_RDONLY | getattr(os, "O_BINARY", 0)

State = Literal["running", "completed", "cancelled", "failed"]
Phase = Literal["listing", "sampling", "hashing", "done"]


class ScanBusy(RuntimeError):
    pass


class StaleScan(LookupError):
    pass


class KeepOneCopy(ValueError):
    pass


class ScanCancelled(Exception):
    pass


class ContentChanged(Exception):
    pass


class CloudOnly(Exception):
    """The file became an online-only placeholder after it was listed."""


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ScanRequest(_Strict):
    path: str = Field(min_length=1, max_length=4096)


class TrashRequest(_Strict):
    scan_id: str = Field(min_length=1, max_length=64)
    file_ids: list[str] = Field(min_length=1, max_length=10_000)


class RevealRequest(_Strict):
    scan_id: str = Field(min_length=1, max_length=64)
    file_id: str = Field(min_length=1, max_length=32)


class DuplicateFile(BaseModel):
    id: str
    path: str
    relative_path: str
    modified: str


class DuplicateGroup(BaseModel):
    id: str
    size: int
    files: list[DuplicateFile]


class DuplicateScan(BaseModel):
    id: str
    root: str
    state: State
    phase: Phase
    files_scanned: int
    progress_done: int
    progress_total: int
    unreadable: int
    cloud_only: int
    truncated: bool
    error: str | None
    group_count: int
    duplicate_count: int
    duplicate_bytes: int
    groups: list[DuplicateGroup]


class TrashFailure(BaseModel):
    id: str
    path: str
    reason: str


class TrashReport(BaseModel):
    trashed: int
    failed: list[TrashFailure]
    scan: DuplicateScan


@dataclass(slots=True)
class FileEntry:
    path: str
    size: int
    mtime_ns: int
    dev: int = 0
    ino: int = 0
    sample: bytes = b""
    digest: bytes = b""
    complete: bool = False
    failed: bool = False
    id: str = ""


@dataclass(slots=True)
class Group:
    id: str
    size: int
    files: list[FileEntry]


@dataclass
class Progress:
    phase: Phase = "listing"
    files: int = 0
    done: int = 0
    total: int = 0
    unreadable: int = 0
    cloud_only: int = 0
    truncated: bool = False
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def start(self, phase: Phase, total: int) -> None:
        with self.lock:
            self.phase, self.done, self.total = phase, 0, total

    def advance(self, amount: int = 1) -> None:
        with self.lock:
            self.done += amount

    def skip_unreadable(self) -> None:
        with self.lock:
            self.unreadable += 1

    def skip_cloud_only(self) -> None:
        with self.lock:
            self.cloud_only += 1


def _distinct(entries: Iterable[FileEntry]) -> list[FileEntry]:
    """Count hard links to one file once, shown under the shortest path.

    Unknown file IDs (0) are never merged.
    """
    seen: set[tuple[int, int]] = set()
    unique = []
    for entry in sorted(entries, key=lambda entry: (len(entry.path), entry.path)):
        if entry.ino:
            key = (entry.dev, entry.ino)
            if key in seen:
                continue
            seen.add(key)
        unique.append(entry)
    return unique


def _walk(root: str, progress: Progress, cancel: threading.Event) -> dict[int, list[FileEntry]]:
    by_size: dict[int, list[FileEntry]] = defaultdict(list)
    root_info = os.stat(root)
    visited = {(root_info.st_dev, root_info.st_ino)} if root_info.st_ino else set()
    pending = [root]
    while pending:
        directory = pending.pop()
        try:
            with os.scandir(directory) as entries:
                for entry in entries:
                    if cancel.is_set():
                        raise ScanCancelled
                    try:
                        info = entry.stat(follow_symlinks=False)
                    except OSError:
                        progress.skip_unreadable()
                        continue
                    if hidden(entry.name, info) or link(info):
                        continue
                    if stat.S_ISDIR(info.st_mode):
                        if package(entry.name):
                            continue
                        if cloud_only(info):
                            # Listing an evicted folder would download its directory.
                            progress.cloud_only += 1
                            continue
                        # Bind mounts can reach a directory twice. Windows reports no
                        # directory IDs here; its junctions are excluded as links.
                        if info.st_ino:
                            key = (info.st_dev, info.st_ino)
                            if key in visited:
                                continue
                            visited.add(key)
                        pending.append(entry.path)
                    elif stat.S_ISREG(info.st_mode) and info.st_size > 0:
                        if cloud_only(info):
                            progress.cloud_only += 1
                        elif progress.files >= MAX_FILES:
                            progress.truncated = True
                            return by_size
                        else:
                            progress.files += 1
                            by_size[info.st_size].append(
                                FileEntry(
                                    entry.path,
                                    info.st_size,
                                    info.st_mtime_ns,
                                    info.st_dev,
                                    info.st_ino,
                                )
                            )
        except OSError:
            if directory == root:
                raise
            progress.skip_unreadable()
    return by_size


def _blake(data: bytes, size: int = 32) -> bytes:
    return hashlib.blake2b(data, digest_size=size).digest()


def full_digest(
    path: str,
    size: int,
    cancel: threading.Event | None = None,
    advance: Callable[[int], None] | None = None,
) -> bytes:
    digest = hashlib.blake2b(digest_size=32)
    buffer = bytearray(CHUNK_BYTES)
    view = memoryview(buffer)
    read = 0
    with open(path, "rb", buffering=0) as handle:
        if cloud_only(os.fstat(handle.fileno())):
            raise CloudOnly
        while count := handle.readinto(buffer):
            if cancel is not None and cancel.is_set():
                raise ScanCancelled
            read += count
            if read > size:
                raise ContentChanged
            digest.update(view[:count])
            if advance is not None:
                advance(count)
    if read != size:
        raise ContentChanged
    return digest.digest()


def _read(fd: int, size: int) -> bytes:
    chunks = []
    while size > 0 and (chunk := os.read(fd, size)):
        chunks.append(chunk)
        size -= len(chunk)
    return b"".join(chunks)


def _sample(entry: FileEntry) -> None:
    # Raw descriptors: fewer interpreter calls per file than buffered file objects.
    fd = os.open(entry.path, OPEN_FLAGS)
    try:
        info = os.fstat(fd)
        if cloud_only(info):
            raise CloudOnly
        if info.st_size != entry.size:
            raise ContentChanged
        if not entry.ino:
            # Windows reports file IDs only for an opened file.
            entry.dev, entry.ino = info.st_dev, info.st_ino
        if entry.size <= SMALL_FILE_BYTES:
            data = _read(fd, entry.size + 1)
            if len(data) != entry.size:
                raise ContentChanged
            entry.digest, entry.complete = _blake(data), True
            return
        head = _read(fd, SAMPLE_BYTES)
        os.lseek(fd, entry.size - SAMPLE_BYTES, os.SEEK_SET)
        tail = _read(fd, SAMPLE_BYTES)
        if len(head) != SAMPLE_BYTES or len(tail) != SAMPLE_BYTES:
            raise ContentChanged
        entry.sample = _blake(head + tail, 16)
    finally:
        os.close(fd)


def _parallel(
    entries: list[FileEntry],
    work: Callable[[FileEntry], None],
    cancel: threading.Event,
    progress: Progress,
    *,
    count_files: bool,
) -> None:
    """Read files on as many threads as actually help.

    Cached files read fastest on one thread; further threads only compete for the
    GIL. Cold disks, virus scanners and network shares need several reads in flight.
    Readers are therefore added one at a time while each raises the throughput.
    """
    iterator = iter(entries)
    lock = threading.Lock()
    finished = threading.Event()
    errors: list[BaseException] = []
    threads: list[threading.Thread] = []
    active = 0
    target = 1

    def run(index: int) -> None:
        nonlocal active
        try:
            keep_cloud_files_online()
            while not cancel.is_set() and index < target:
                with lock:
                    entry = next(iterator, None)
                if entry is None:
                    return
                try:
                    work(entry)
                except ScanCancelled:
                    return
                except CloudOnly:
                    entry.failed = True
                    progress.skip_cloud_only()
                except OSError as error:
                    entry.failed = True
                    # macOS refuses to read evicted files (EDEADLK) instead of downloading.
                    if error.errno == errno.EDEADLK:
                        progress.skip_cloud_only()
                    else:
                        progress.skip_unreadable()
                except ContentChanged:
                    # Changed or locked by another program during the scan.
                    entry.failed = True
                    progress.skip_unreadable()
                except BaseException as error:
                    errors.append(error)
                    cancel.set()
                    return
                if count_files:
                    progress.advance()
        finally:
            with lock:
                active -= 1
                if not active:
                    finished.set()

    def add_reader() -> None:
        nonlocal active
        with lock:
            active += 1
        thread = threading.Thread(
            target=run, args=(len(threads),), name="duplicate-scan-io", daemon=True
        )
        threads.append(thread)
        thread.start()

    if entries:
        add_reader()
        best, growing = 0.0, True
        before, started = progress.done, time.perf_counter()
        while not finished.wait(PROBE_SECONDS):
            if not growing:
                continue
            now = time.perf_counter()
            rate = (progress.done - before) / (now - started)
            before, started = progress.done, now
            if rate > best * MIN_GAIN and target < MAX_READERS:
                best = rate
                target += 1
                add_reader()
            else:
                if target > 1 and rate <= best * MIN_GAIN:
                    target -= 1  # The newest reader stops after its current file.
                growing = False
        for thread in threads:
            thread.join()
    if errors:
        raise errors[0]
    if cancel.is_set():
        raise ScanCancelled


def _regroup(
    groups: Iterable[list[FileEntry]], key: Callable[[FileEntry], Hashable]
) -> list[list[FileEntry]]:
    result = []
    for group in groups:
        if len(group) < 2:
            continue
        buckets: dict[Hashable, list[FileEntry]] = defaultdict(list)
        for entry in group:
            if not entry.failed:
                buckets[key(entry)].append(entry)
        for bucket in buckets.values():
            unique = _distinct(bucket)
            if len(unique) > 1:
                result.append(unique)
    return result


def find_duplicates(
    root: str, progress: Progress, cancel: threading.Event
) -> list[list[FileEntry]]:
    by_size = _walk(root, progress, cancel)
    candidates = _regroup(by_size.values(), lambda entry: entry.size)
    by_size.clear()
    entries = [entry for group in candidates for entry in group]
    progress.start("sampling", len(entries))
    _parallel(entries, _sample, cancel, progress, count_files=True)
    groups = _regroup(candidates, lambda entry: entry.digest if entry.complete else entry.sample)
    # Large files first, so that the remaining small reads balance the threads.
    pending = sorted(
        (entry for group in groups for entry in group if not entry.complete),
        key=lambda entry: entry.size,
        reverse=True,
    )
    progress.start("hashing", sum(entry.size for entry in pending))

    def hash_file(entry: FileEntry) -> None:
        entry.digest = full_digest(entry.path, entry.size, cancel, progress.advance)
        entry.complete = True

    _parallel(pending, hash_file, cancel, progress, count_files=False)
    groups = _regroup(groups, lambda entry: entry.digest)
    progress.start("done", 0)
    return groups


def _modified(entry: FileEntry) -> str:
    try:
        return datetime.fromtimestamp(entry.mtime_ns / 1e9, UTC).isoformat()
    except (OverflowError, OSError, ValueError):
        return ""


def _state(entry: FileEntry) -> tuple[int, int] | None:
    try:
        info = os.stat(entry.path, follow_symlinks=False)
    except OSError:
        return None
    if not stat.S_ISREG(info.st_mode) or cloud_only(info):
        return None
    return info.st_size, info.st_mtime_ns


def _unchanged(entry: FileEntry) -> tuple[int, int] | None:
    """Re-read a file before acting on it: same size and same digest of its content.

    Returns the file's size and modification time at that moment, otherwise None.
    """
    state = _state(entry)
    if state is None or state[0] != entry.size:
        return None
    try:
        if full_digest(entry.path, entry.size) != entry.digest:
            return None
    except (OSError, ContentChanged, CloudOnly):
        return None
    return state if _state(entry) == state else None


class ScanJob:
    def __init__(self, root: str):
        self.id = uuid4().hex
        self.root = root
        self.state: State = "running"
        self.error: str | None = None
        self.progress = Progress()
        self.cancel = threading.Event()
        self.lock = threading.Lock()
        self.groups: list[Group] = []
        self.trashing = False
        self.thread = threading.Thread(target=self._run, name="duplicate-scan", daemon=True)
        self.thread.start()

    def _run(self) -> None:
        groups: list[Group] = []
        error = None
        try:
            found = find_duplicates(self.root, self.progress, self.cancel)
            state: State = "completed"
        except ScanCancelled:
            state = "cancelled"
        except OSError as failure:
            state, error = "failed", access_message(failure)
        except Exception as failure:  # Paths are private; log the type only.
            logger.error("Duplicate scan stopped after %s", type(failure).__name__)
            state, error = "failed", "Die Suche wurde unerwartet beendet. Bitte erneut starten."
        else:
            groups = self._numbered(found)
        with self.lock:
            self.groups, self.state, self.error = groups, state, error

    def _numbered(self, found: list[list[FileEntry]]) -> list[Group]:
        shown = []
        for entries in found:
            readable = [entry for entry in entries if encodable(entry.path)]
            self.progress.unreadable += len(entries) - len(readable)
            if len(readable) > 1:
                # The oldest file leads; "Neuere Kopien auswählen" keeps it.
                readable.sort(key=lambda entry: (entry.mtime_ns, len(entry.path), entry.path))
                shown.append(readable)
        shown.sort(key=lambda entries: (-entries[0].size * (len(entries) - 1), entries[0].path))
        groups = []
        number = 0
        for index, entries in enumerate(shown):
            for entry in entries:
                entry.id, entry.sample = str(number), b""
                number += 1
            groups.append(Group(f"g{index}", entries[0].size, entries))
        return groups

    def snapshot(self) -> DuplicateScan:
        with self.lock:
            progress, groups = self.progress, self.groups
            return DuplicateScan(
                id=self.id,
                root=self.root,
                state=self.state,
                phase=progress.phase,
                files_scanned=progress.files,
                progress_done=progress.done,
                progress_total=progress.total,
                unreadable=progress.unreadable,
                cloud_only=progress.cloud_only,
                truncated=progress.truncated,
                error=self.error,
                group_count=len(groups),
                duplicate_count=sum(len(group.files) - 1 for group in groups),
                duplicate_bytes=sum(group.size * (len(group.files) - 1) for group in groups),
                groups=[
                    DuplicateGroup(
                        id=group.id,
                        size=group.size,
                        files=[
                            DuplicateFile(
                                id=entry.id,
                                path=entry.path,
                                relative_path=os.path.relpath(entry.path, self.root),
                                modified=_modified(entry),
                            )
                            for entry in group.files
                        ],
                    )
                    for group in groups[:MAX_GROUPS]
                ],
            )

    def entry(self, file_id: str) -> FileEntry:
        with self.lock:
            for group in self.groups:
                for entry in group.files:
                    if entry.id == file_id:
                        return entry
        raise StaleScan

    def trash(self, file_ids: list[str]) -> tuple[int, list[TrashFailure]]:
        """Move the selected copies to the trash after reading them and a kept copy again."""
        selected = set(file_ids)
        with self.lock:
            if self.state != "completed" or self.trashing:
                raise StaleScan
            if not selected <= {entry.id for group in self.groups for entry in group.files}:
                raise StaleScan
            plan = []
            for group in self.groups:
                chosen = [entry for entry in group.files if entry.id in selected]
                kept = [entry for entry in group.files if entry.id not in selected]
                if chosen and not kept:
                    raise KeepOneCopy
                if chosen:
                    plan.append((chosen, kept))
            self.trashing = True
        trashed: set[str] = set()
        failed: dict[str, TrashFailure] = {}

        def fail(entry: FileEntry, reason: str) -> None:
            failed[entry.id] = TrashFailure(id=entry.id, path=entry.path, reason=reason)

        keep_cloud_files_online()
        stopped = False
        try:
            for chosen, kept in plan:
                if stopped:
                    break
                keeper, keeper_state = None, None
                for candidate in kept:
                    if keeper_state := _unchanged(candidate):
                        keeper = candidate
                        break
                for entry in chosen:
                    if keeper is None or _state(keeper) != keeper_state:
                        fail(entry, "Keine unveränderte Kopie dieser Datei mehr vorhanden.")
                    elif same_file(keeper.path, entry.path):
                        fail(entry, "Keine unabhängige Kopie dieser Datei vorhanden.")
                    elif not _unchanged(entry):
                        fail(entry, "Seit der Suche geändert oder entfernt.")
                    elif reason := move_to_trash(entry.path, entry.size):
                        fail(entry, reason)
                    else:
                        trashed.add(entry.id)
                        # The kept copy must survive every move; otherwise stop at once.
                        if _state(keeper) != keeper_state:
                            stopped = True
                            break
            if stopped:
                for items, _ in plan:
                    for item in items:
                        if item.id not in trashed and item.id not in failed:
                            fail(item, "Abgebrochen: Die behaltene Kopie fehlt.")
        finally:
            with self.lock:
                for group in self.groups:
                    group.files = [entry for entry in group.files if entry.id not in trashed]
                self.groups = [group for group in self.groups if len(group.files) > 1]
                self.trashing = False
        return len(trashed), list(failed.values())


class DuplicateFinder:
    """The current scan of this workspace. One scan runs at a time."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._job: ScanJob | None = None

    def start(self, path: str) -> DuplicateScan:
        root = folder_path(path)
        with self._lock:
            job = self._job
            if job and (job.thread.is_alive() or job.trashing):
                raise ScanBusy
            self._job = ScanJob(root)
            return self._job.snapshot()

    def current(self) -> DuplicateScan | None:
        job = self._job
        return job.snapshot() if job else None

    def cancel(self) -> DuplicateScan | None:
        job = self._job
        if job is None:
            return None
        job.cancel.set()
        return job.snapshot()

    def job(self, scan_id: str) -> ScanJob:
        job = self._job
        if job is None or job.id != scan_id:
            raise StaleScan
        return job

    def close(self) -> None:
        job = self._job
        if job:
            job.cancel.set()
            job.thread.join(timeout=5)
