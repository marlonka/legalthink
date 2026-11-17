"""Operating-system integration for working with files on this computer.

Used by the duplicate search only while the workspace runs locally. Windows, macOS
and Linux differ in how they mark hidden files, links, cloud placeholders and the
trash. Every check here fails closed: when in doubt, a file is skipped or kept.
"""

from __future__ import annotations

import errno
import os
import re
import stat
import string
import subprocess
import sys
import threading
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

MAX_FOLDERS = 2_000

# Windows attributes and reparse tags; the stat module defines some only on Windows.
FILE_ATTRIBUTE_RECALL_ON_OPEN = 0x40000
FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS = 0x400000
CLOUD_ATTRIBUTES = (
    stat.FILE_ATTRIBUTE_OFFLINE
    | FILE_ATTRIBUTE_RECALL_ON_OPEN
    | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS
)
HIDDEN_ATTRIBUTES = stat.FILE_ATTRIBUTE_HIDDEN | stat.FILE_ATTRIBUTE_SYSTEM
# Name surrogates (symlinks, junctions, mount points) point elsewhere; so do app aliases.
NAME_SURROGATE = 0x20000000
IO_REPARSE_TAG_APPEXECLINK = 0x8000001B
# macOS marks evicted iCloud Drive and File Provider items as dataless (stat.SF_DATALESS, 3.13+).
SF_DATALESS = 0x40000000
# macOS packages appear as single files in Finder; their content belongs to an app or library.
PACKAGE_SUFFIXES = frozenset(
    ".app .appex .aplibrary .band .bundle .dtbase2 .dtsparse .fcpbundle .framework "
    ".imovielibrary .kext .key .logicx .migratedphotolibrary .musiclibrary .numbers .pages "
    ".photolibrary .photoslibrary .playground .plugin .rtfd .scriv .sparsebundle .tvlibrary "
    ".xcodeproj .xcworkspace .xpc".split()
)
# Shell paths of a file and of its folder stay below MAX_PATH.
MAX_RECYCLE_PATH = 248

Platform = Literal["windows", "macos", "linux"]


class FolderError(ValueError):
    """The folder cannot be used. The message is shown to the user."""


class Location(BaseModel):
    label: str
    path: str


class Locations(BaseModel):
    platform: Platform
    locations: list[Location]
    volumes: list[Location]


class Folder(BaseModel):
    name: str
    path: str


class FolderListing(BaseModel):
    path: str
    parent: str | None
    folders: list[Folder]
    truncated: bool


def platform_name() -> Platform:
    if sys.platform == "win32":
        return "windows"
    return "macos" if sys.platform == "darwin" else "linux"


def access_message(error: OSError) -> str:
    if sys.platform == "darwin" and error.errno == errno.EPERM:
        return (
            "macOS verweigert den Zugriff auf diesen Ordner. Erlauben Sie ihn für das Terminal "
            "oder die App, aus der LegalThink gestartet wurde: Systemeinstellungen → "
            "Datenschutz & Sicherheit → Dateien und Ordner."
        )
    return "Der Ordner kann nicht gelesen werden. Bitte die Zugriffsrechte prüfen."


def folder_path(value: str) -> str:
    """Normalize a typed or pasted folder; it must be an existing directory."""
    text = value.strip()
    # Explorer's "Als Pfad kopieren" adds quotes.
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "\"'":
        text = text[1:-1].strip()
    if not text:
        raise FolderError("Bitte einen Ordner angeben.")
    text = os.path.expanduser(text)
    if sys.platform == "win32" and re.fullmatch(r"[A-Za-z]:", text):
        text += "\\"
    if not os.path.isabs(text):
        example = {
            "windows": r"C:\Users\Name\Documents",
            "macos": "/Users/Name/Documents",
            "linux": "/home/name/Dokumente",
        }[platform_name()]
        raise FolderError(f"Bitte den vollständigen Pfad angeben, zum Beispiel {example}.")
    path = os.path.normpath(text)
    try:
        info = os.stat(path)
    except FileNotFoundError:
        raise FolderError("Der Ordner wurde nicht gefunden.") from None
    except OSError as error:
        raise FolderError(access_message(error)) from None
    if not stat.S_ISDIR(info.st_mode):
        raise FolderError("Der Pfad ist kein Ordner.")
    return path


def hidden(name: str, info: os.stat_result) -> bool:
    # "~$" names are Office lock files, created for every open document.
    return (
        name.startswith((".", "~$"))
        or bool(getattr(info, "st_file_attributes", 0) & HIDDEN_ATTRIBUTES)
        or bool(getattr(info, "st_flags", 0) & stat.UF_HIDDEN)
    )


def link(info: os.stat_result) -> bool:
    if stat.S_ISLNK(info.st_mode):
        return True
    # Windows junctions are directories with a reparse tag, not symlinks.
    if not getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
        return False
    tag = getattr(info, "st_reparse_tag", 0)
    return bool(tag & NAME_SURROGATE) or tag == IO_REPARSE_TAG_APPEXECLINK


def cloud_only(info: os.stat_result) -> bool:
    """Reading this item would download it from OneDrive, iCloud or another provider."""
    return bool(getattr(info, "st_file_attributes", 0) & CLOUD_ATTRIBUTES) or bool(
        getattr(info, "st_flags", 0) & SF_DATALESS
    )


def package(name: str) -> bool:
    return os.path.splitext(name)[1].lower() in PACKAGE_SUFFIXES


def encodable(path: str) -> bool:
    # Undecodable names (lone surrogates) cannot be shown or sent back by the browser.
    try:
        path.encode("utf-8")
    except UnicodeEncodeError:
        return False
    return True


def keep_cloud_files_online() -> None:
    """On macOS, make reads of dataless files fail (EDEADLK) instead of downloading them.

    The attribute checks skip such files; this also covers an item evicted between
    listing and reading. Applies to the calling thread only.
    """
    if sys.platform != "darwin":
        return
    try:
        import ctypes

        libc = ctypes.CDLL(None, use_errno=True)
        # IOPOL_TYPE_VFS_MATERIALIZE_DATALESS_FILES, IOPOL_SCOPE_THREAD,
        # IOPOL_MATERIALIZE_DATALESS_FILES_OFF from <sys/resource.h>.
        libc.setiopolicy_np(3, 1, 1)
    except (OSError, AttributeError):
        pass


def same_file(first: str, second: str) -> bool:
    """True unless both paths provably name different files."""
    try:
        if os.path.samefile(first, second):
            return True
        return os.path.normcase(os.path.realpath(first, strict=True)) == os.path.normcase(
            os.path.realpath(second, strict=True)
        )
    except OSError:
        return True


def _windows_registry_value(hive: int, key: str, name: str) -> int | None:
    import winreg

    try:
        with winreg.OpenKey(hive, key) as handle:
            value, kind = winreg.QueryValueEx(handle, name)
    except OSError:
        return None
    return value if kind == winreg.REG_DWORD else None


BIN_SETTINGS = r"Software\Microsoft\Windows\CurrentVersion\Explorer\BitBucket"
BIN_POLICY = r"Software\Microsoft\Windows\CurrentVersion\Policies\Explorer"


def windows_volume(target: str) -> tuple[str, int] | None:
    """Volume GUID and size of a drive-letter volume with its own Recycle Bin."""
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.GetVolumePathNameW.argtypes = [wintypes.LPCWSTR, wintypes.LPWSTR, wintypes.DWORD]
    kernel32.GetVolumePathNameW.restype = wintypes.BOOL
    kernel32.GetDriveTypeW.argtypes = [wintypes.LPCWSTR]
    kernel32.GetDriveTypeW.restype = wintypes.UINT
    kernel32.GetVolumeNameForVolumeMountPointW.argtypes = [
        wintypes.LPCWSTR,
        wintypes.LPWSTR,
        wintypes.DWORD,
    ]
    kernel32.GetVolumeNameForVolumeMountPointW.restype = wintypes.BOOL
    kernel32.GetDiskFreeSpaceExW.argtypes = [
        wintypes.LPCWSTR,
        ctypes.POINTER(ctypes.c_ulonglong),
        ctypes.POINTER(ctypes.c_ulonglong),
        ctypes.POINTER(ctypes.c_ulonglong),
    ]
    kernel32.GetDiskFreeSpaceExW.restype = wintypes.BOOL
    mount = ctypes.create_unicode_buffer(1024)
    volume = ctypes.create_unicode_buffer(64)
    total = ctypes.c_ulonglong()
    drive_fixed = 3
    if (
        not kernel32.GetVolumePathNameW(target, mount, len(mount))
        # Volumes mounted into a folder have no Recycle Bin of their own.
        or not re.fullmatch(r"[A-Za-z]:\\", mount.value)
        or kernel32.GetDriveTypeW(mount.value) != drive_fixed
        # Fails for SUBST drives, which have no Recycle Bin either.
        or not kernel32.GetVolumeNameForVolumeMountPointW(mount.value, volume, len(volume))
        or not kernel32.GetDiskFreeSpaceExW(mount.value, None, ctypes.byref(total), None)
    ):
        return None
    guid = re.search(r"\{[0-9A-Fa-f-]{36}\}", volume.value)
    return (guid[0], total.value) if guid else None


def _windows_bin_disabled_for(target: str) -> bool:
    """Redirected known folders (Documents, Desktop …) can switch the bin off."""
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, BIN_SETTINGS + r"\KnownFolder") as folders:
            index = 0
            while True:
                try:
                    folder_id = winreg.EnumKey(folders, index)
                except OSError:
                    return False
                index += 1
                key = BIN_SETTINGS + r"\KnownFolder" + "\\" + folder_id
                if not _windows_registry_value(winreg.HKEY_CURRENT_USER, key, "NukeOnDelete"):
                    continue
                folder = _windows_known_folder(folder_id)
                if folder is None or os.path.normcase(target).startswith(
                    os.path.normcase(str(folder)).rstrip("\\") + "\\"
                ):
                    return True
    except OSError:
        return False


def windows_recycle_problem(path: str, size: int) -> tuple[str | None, str]:
    """First barrier: reject files the Windows shell would not recycle.

    The shell deletes permanently what it cannot recycle: files on network shares,
    removable, SUBST or folder-mounted drives, with a disabled Recycle Bin or above its
    size limit. `windows_recycle` additionally refuses such items while they are being
    deleted. Returns the problem, if any, and the resolved path to recycle.
    """
    import winreg

    unsupported = "Für dieses Laufwerk ist kein Papierkorb verfügbar."
    disabled = "Der Papierkorb ist für dieses Laufwerk ausgeschaltet."
    # Resolves SUBST drives to their volume and mapped network drives to UNC paths.
    target = os.path.realpath(path, strict=True)
    name = os.path.basename(target)
    if target.startswith("\\\\"):
        return unsupported, target
    if len(target) >= MAX_RECYCLE_PATH:
        return "Der Pfad ist für den Papierkorb zu lang.", target
    # Win32 strips trailing dots and spaces, so the shell would act on another name.
    if name.rstrip(". ") != name or not os.path.samefile(path, target):
        return "Dieser Dateiname wird vom Papierkorb nicht unterstützt.", target
    volume = windows_volume(target)
    if volume is None:
        return unsupported, target
    guid, total = volume
    settings = BIN_SETTINGS + r"\Volume" + "\\" + guid
    hives = (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE)
    if (
        any(_windows_registry_value(hive, BIN_POLICY, "NoRecycleFiles") for hive in hives)
        or _windows_registry_value(winreg.HKEY_CURRENT_USER, settings, "NukeOnDelete")
        or _windows_bin_disabled_for(target)
    ):
        return disabled, target
    # Without a stored MaxCapacity (megabytes), Windows reserves a share of the volume.
    limit = min(1024 * 1024 * 1024, total // 20)
    capacity = _windows_registry_value(winreg.HKEY_CURRENT_USER, settings, "MaxCapacity")
    if capacity is not None:
        limit = capacity * 1024 * 1024
    for hive in hives:
        percent = _windows_registry_value(hive, BIN_POLICY, "RecycleBinSize")
        if percent is not None:
            limit = min(limit, total * percent // 100)
    if size >= limit:
        return "Die Datei ist zu groß für den Papierkorb.", target
    return None, target


def windows_recycle(path: str) -> str | None:
    """Second barrier: recycle through the shell, refusing any permanent deletion.

    The shell reports each item to a progress sink before deleting it. Without
    TSF_DELETE_RECYCLE_IF_POSSIBLE it would delete permanently; the sink then raises,
    which cancels the item. Afterwards the sink must have seen the new Recycle Bin item.
    COM runs on its own short-lived single-threaded apartment.
    """
    result: list[str | None] = []

    def run() -> None:
        try:
            result.append(_windows_recycle_in_apartment(path))
        except Exception:
            result.append("Die Datei konnte nicht in den Papierkorb verschoben werden.")

    thread = threading.Thread(target=run, name="recycle-file", daemon=True)
    thread.start()
    thread.join()
    return result[0] if result else "Die Datei konnte nicht in den Papierkorb verschoben werden."


def _windows_recycle_in_apartment(path: str) -> str | None:
    import pythoncom
    import pywintypes
    import winerror
    from win32com.server.exception import COMException
    from win32com.server.policy import DesignatedWrapPolicy
    from win32com.shell import shell, shellcon

    def accept(self, *args) -> None:
        return None

    class RecycleOnly(DesignatedWrapPolicy):
        _com_interfaces_ = [shell.IID_IFileOperationProgressSink]
        _public_methods_ = [
            "StartOperations",
            "FinishOperations",
            "PreRenameItem",
            "PostRenameItem",
            "PreMoveItem",
            "PostMoveItem",
            "PreCopyItem",
            "PostCopyItem",
            "PreDeleteItem",
            "PostDeleteItem",
            "PreNewItem",
            "PostNewItem",
            "UpdateProgress",
            "ResetTimer",
            "PauseTimer",
            "ResumeTimer",
        ]
        StartOperations = FinishOperations = PreRenameItem = PostRenameItem = accept
        PreMoveItem = PostMoveItem = PreCopyItem = PostCopyItem = accept
        PreNewItem = PostNewItem = UpdateProgress = accept
        ResetTimer = PauseTimer = ResumeTimer = accept

        def __init__(self) -> None:
            self._wrap_(self)
            self.recycled = False

        def PreDeleteItem(self, flags, item) -> None:
            # A returned HRESULT is ignored by the gateway; only an exception cancels.
            if not flags & shellcon.TSF_DELETE_RECYCLE_IF_POSSIBLE:
                raise COMException(scode=winerror.E_ABORT)

        def PostDeleteItem(self, flags, item, outcome, recycled_item) -> None:
            # Failure HRESULTs have bit 31 set, whether passed signed or unsigned.
            self.recycled = not outcome & 0x80000000 and recycled_item is not None

    def perform() -> tuple[bool, bool]:
        # COM references stay local, so they are released before CoUninitialize.
        operation = pythoncom.CoCreateInstance(
            shell.CLSID_FileOperation, None, pythoncom.CLSCTX_ALL, shell.IID_IFileOperation
        )
        operation.SetOperationFlags(
            shellcon.FOF_SILENT
            | shellcon.FOF_NOCONFIRMATION
            | shellcon.FOF_NOERRORUI
            | shellcon.FOF_NOCONFIRMMKDIR
            | shellcon.FOF_ALLOWUNDO
            | 0x00080000  # FOFX_RECYCLEONDELETE
            | 0x20000000  # FOFX_ADDUNDORECORD: Explorer can undo the move.
            | shellcon.FOFX_EARLYFAILURE
        )
        sink = RecycleOnly()
        item = shell.SHCreateItemFromParsingName(path, None, shell.IID_IShellItem)
        operation.DeleteItem(item, pythoncom.WrapObject(sink, shell.IID_IFileOperationProgressSink))
        try:
            operation.PerformOperations()
        except pywintypes.com_error:
            return False, True
        return sink.recycled, bool(operation.GetAnyOperationsAborted())

    pythoncom.CoInitializeEx(pythoncom.COINIT_APARTMENTTHREADED)
    try:
        try:
            recycled, aborted = perform()
        except pywintypes.com_error:
            recycled, aborted = False, True
    finally:
        pythoncom.CoUninitialize()
    if aborted or not recycled:
        return "Windows hätte die Datei endgültig gelöscht; sie wurde nicht verschoben."
    return None


def move_to_trash(path: str, size: int) -> str | None:
    """Move a file to the trash; returns why it stayed in place, if it did."""
    if sys.platform == "win32":
        try:
            problem, target = windows_recycle_problem(path, size)
            if problem is None:
                problem = windows_recycle(target)
        except Exception:  # A failed check must never lead to a permanent deletion.
            problem = "Der Papierkorb für dieses Laufwerk konnte nicht geprüft werden."
        if problem is None and os.path.lexists(path):
            problem = "Die Datei konnte nicht in den Papierkorb verschoben werden."
        return problem
    # Imported on first use: the macOS and freedesktop variants load native libraries.
    from send2trash import send2trash
    from send2trash.exceptions import TrashPermissionError

    try:
        # Neither variant deletes: macOS and freedesktop trashes only move files.
        send2trash(path)
    except TrashPermissionError:
        return "Für dieses Laufwerk ist kein Papierkorb verfügbar."
    except PermissionError:
        return "Keine Berechtigung, die Datei zu verschieben."
    except OSError:
        return "Die Datei konnte nicht in den Papierkorb verschoben werden."
    if os.path.lexists(path):
        return "Die Datei konnte nicht in den Papierkorb verschoben werden."
    return None


def reveal(path: str) -> None:
    """Show the file in Finder or Explorer; elsewhere open its folder."""
    if sys.platform == "darwin":
        command: str | list[str] = ["/usr/bin/open", "-R", path]
    elif sys.platform == "win32":
        explorer = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "explorer.exe")
        # Explorer parses its own command line. Windows file names cannot contain quotes.
        command = f'"{explorer}" /select,"{path}"'
    else:
        command = ["xdg-open", os.path.dirname(path)]
    process = subprocess.Popen(
        command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    threading.Thread(target=process.wait, name="reveal-file", daemon=True).start()


def _windows_known_folder(guid: str) -> Path | None:
    """Documents, Downloads and Desktop can be redirected, for example into OneDrive."""
    import ctypes
    from ctypes import wintypes
    from uuid import UUID

    class GUID(ctypes.Structure):
        _fields_ = [
            ("Data1", wintypes.DWORD),
            ("Data2", wintypes.WORD),
            ("Data3", wintypes.WORD),
            ("Data4", wintypes.BYTE * 8),
        ]

    folder_id = GUID.from_buffer_copy(UUID(guid).bytes_le)
    result = ctypes.c_wchar_p()
    shell32 = ctypes.WinDLL("shell32")
    ole32 = ctypes.WinDLL("ole32")
    shell32.SHGetKnownFolderPath.argtypes = [
        ctypes.POINTER(GUID),
        wintypes.DWORD,
        wintypes.HANDLE,
        ctypes.POINTER(ctypes.c_wchar_p),
    ]
    shell32.SHGetKnownFolderPath.restype = ctypes.HRESULT
    try:
        shell32.SHGetKnownFolderPath(ctypes.byref(folder_id), 0, None, ctypes.byref(result))
        return Path(result.value) if result.value else None
    except OSError:
        return None
    finally:
        ole32.CoTaskMemFree(result)


def _volumes() -> list[Location]:
    if sys.platform == "win32":
        import ctypes

        mask = ctypes.WinDLL("kernel32").GetLogicalDrives()
        return [
            Location(label=f"{letter}:", path=f"{letter}:\\")
            for index, letter in enumerate(string.ascii_uppercase)
            if mask >> index & 1
        ]
    volumes = [Location(label="/", path="/")]
    if sys.platform == "darwin":
        parents = [Path("/Volumes")]
    else:
        user = os.environ.get("USER", "")
        parents = [Path("/media") / user, Path("/run/media") / user, Path("/mnt")]
    for parent in parents:
        try:
            children = sorted(parent.iterdir(), key=lambda child: child.name.casefold())
        except OSError:
            continue
        for child in children:
            # macOS lists the startup volume as a link to /.
            if child.name.startswith(".") or not child.is_dir() or os.path.realpath(child) == "/":
                continue
            volumes.append(Location(label=child.name, path=str(child)))
    return volumes


def locations() -> Locations:
    home = Path.home()
    candidates: list[tuple[str, Path | None]] = [("Benutzerordner", home)]
    if sys.platform == "win32":
        known = {
            "Dokumente": ("{FDD39AD0-238F-46AF-ADB4-6C85480369C7}", "Documents"),
            "Downloads": ("{374DE290-123F-4565-9164-39C4925E467B}", "Downloads"),
            "Schreibtisch": ("{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}", "Desktop"),
        }
        for label, (guid, fallback) in known.items():
            try:
                folder = _windows_known_folder(guid)
            except Exception:
                folder = None
            candidates.append((label, folder or home / fallback))
        for variable in ("OneDriveCommercial", "OneDriveConsumer", "OneDrive"):
            if os.environ.get(variable):
                candidates.append(("OneDrive", Path(os.environ[variable])))
    else:
        for label, names in (
            ("Dokumente", ("Documents", "Dokumente")),
            ("Downloads", ("Downloads",)),
            ("Schreibtisch", ("Desktop", "Schreibtisch")),
        ):
            candidates += [(label, home / name) for name in names]
        if sys.platform == "darwin":
            library = home / "Library"
            candidates.append(
                ("iCloud Drive", library / "Mobile Documents" / "com~apple~CloudDocs")
            )
            try:
                services = sorted((library / "CloudStorage").iterdir())
            except OSError:
                services = []
            candidates += [(service.name, service) for service in services]
    found: list[Location] = []
    seen: set[str] = set()
    for label, folder in candidates:
        if folder is None or not folder.is_dir():
            continue
        key = os.path.normcase(os.path.realpath(folder))
        if key not in seen:
            seen.add(key)
            found.append(Location(label=label, path=str(folder)))
    return Locations(platform=platform_name(), locations=found, volumes=_volumes())


def list_folders(path: str) -> FolderListing:
    directory = folder_path(path)
    folders = []
    try:
        with os.scandir(directory) as entries:
            for entry in entries:
                try:
                    info = entry.stat(follow_symlinks=False)
                    if hidden(entry.name, info) or package(entry.name):
                        continue
                    # A linked folder chosen here becomes the scan root and is followed.
                    is_folder = entry.is_dir() if link(info) else stat.S_ISDIR(info.st_mode)
                except OSError:
                    continue
                if is_folder and encodable(entry.path):
                    folders.append(Folder(name=entry.name, path=entry.path))
    except OSError as error:
        raise FolderError(access_message(error)) from None
    folders.sort(key=lambda folder: folder.name.casefold())
    parent = os.path.dirname(directory)
    return FolderListing(
        path=directory,
        parent=parent if parent != directory else None,
        folders=folders[:MAX_FOLDERS],
        truncated=len(folders) > MAX_FOLDERS,
    )
