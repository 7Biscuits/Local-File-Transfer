import socket
import logging
import json
from pathlib import Path
from datetime import datetime
from typing import List

from fastapi import FastAPI, File, UploadFile, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn

# Configuration

# Root directory where photos is stored
TRANSFER_ROOT = Path.home() / "PhotoTransfers"

# Allowed file types - images & videos
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", # photos
    ".mp4", ".mov", ".avi", ".mkv", ".webm", ".3gp", ".m4v", # videos
}
ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/jpg",
    "video/mp4", "video/quicktime", "video/x-msvideo",
    "video/x-matroska", "video/webm", "video/3gpp", "video/x-m4v",
}


MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024  # 4 GB in bytes

# Local transfer log
LOG_FILE = TRANSFER_ROOT / "transfers.log"

# Logging setup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("photo-transfer")

# FastAPI app
app = FastAPI(
    title="Photo Transfer",
    description="Local-only LAN photo transfer server",
    version="1.0.0",
    docs_url=None, # never used swagger ui in my entire life
    redoc_url=None,
)


app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

# Helpers

def get_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def today_folder() -> Path:
    """
    Return (and create if needed) ~/PhotoTransfers/YYYY-MM-DD/
    based on today's date.
    """
    folder = TRANSFER_ROOT / datetime.now().strftime("%Y-%m-%d")
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def safe_filename(folder: Path, original_name: str) -> Path:
    """
    Prevent filename collisions.
    photo.jpg → photo(1).jpg → photo(2).jpg
    """
    stem = Path(original_name).stem
    suffix = Path(original_name).suffix.lower()
    candidate = folder / f"{stem}{suffix}"

    if not candidate.exists():
        return candidate

    counter = 1
    while True:
        candidate = folder / f"{stem}({counter}){suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def log_transfer(filename: str, size: int, saved_to: Path) -> None:
    # Append a one-line transfer record to transfers.log (local only)
    try:
        TRANSFER_ROOT.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "filename": filename,
            "size_bytes": size,
            "saved_to": str(saved_to),
        }
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as exc:
        logger.warning("Could not write to transfer log: %s", exc)


def recent_uploads(limit: int = 20) -> list[dict]:
    if not LOG_FILE.exists():
        return []
    try:
        lines = LOG_FILE.read_text(encoding="utf-8").strip().splitlines()
        entries = []
        for line in reversed(lines[-limit:]):
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return entries
    except Exception:
        return []


def total_received() -> int:
    if not LOG_FILE.exists():
        return 0
    try:
        return sum(1 for line in LOG_FILE.read_text(encoding="utf-8").splitlines() if line.strip())
    except Exception:
        return 0

# Routes

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Serve the single-page UI."""
    local_ip = get_local_ip()
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "local_ip": local_ip,
            "port": 8000,
            "total_received": total_received(),
            "transfer_root": str(TRANSFER_ROOT),
            "recent_uploads": recent_uploads(20),
        },
    )


@app.get("/api/status")
async def status():
    return {
        "status": "online",
        "local_ip": get_local_ip(),
        "transfer_root": str(TRANSFER_ROOT),
        "total_received": total_received(),
        "timestamp": datetime.now().isoformat(timespec="seconds"),
    }


@app.get("/api/recent")
async def get_recent():
    # Return recent upload entries for the desktop dashboard.
    return {"uploads": recent_uploads(20), "total": total_received()}


@app.post("/upload")
async def upload_photos(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    destination_folder = today_folder()
    results = []

    for upload in files:
        filename = upload.filename or "unknown"
        ext = Path(filename).suffix.lower()

        # ── Validate extension ──────────────────────────────────────────
        if ext not in ALLOWED_EXTENSIONS:
            results.append({
                "filename": filename,
                "status": "error",
                "reason": f"Unsupported file type '{ext}'. Allowed: jpg, jpeg, png, mp4, mov, avi, mkv, webm, 3gp, m4v.",
            })
            logger.warning("Rejected file '%s' — unsupported extension.", filename)
            continue

        # Read file content
        try:
            content = await upload.read()
        except Exception as exc:
            results.append({"filename": filename, "status": "error", "reason": str(exc)})
            logger.error("Failed to read '%s': %s", filename, exc)
            continue

        # Validate size
        size = len(content)
        if size == 0:
            results.append({"filename": filename, "status": "error", "reason": "Empty file."})
            continue
        if size > MAX_FILE_SIZE:
            results.append({
                "filename": filename,
                "status": "error",
                "reason": f"File too large ({size / 1024 / 1024:.1f} MB). Limit is 4 GB per file.",
            })
            continue

        # Save file
        try:
            target = safe_filename(destination_folder, filename)
            target.write_bytes(content)
            log_transfer(filename, size, target)

            results.append({
                "filename": filename,
                "saved_as": target.name,
                "size_bytes": size,
                "saved_to": str(destination_folder),
                "status": "ok",
            })
            logger.info("Saved  %-40s  %s  →  %s", filename, f"({size / 1024:.1f} KB)", target)

        except OSError as exc:
            results.append({"filename": filename, "status": "error", "reason": str(exc)})
            logger.error("OS error saving '%s': %s", filename, exc)

    success_count = sum(1 for r in results if r["status"] == "ok")
    error_count = len(results) - success_count

    return JSONResponse({
        "success": error_count == 0,
        "received": len(results),
        "saved": success_count,
        "errors": error_count,
        "destination": str(destination_folder),
        "results": results,
    })


# Startup

@app.on_event("startup")
async def on_startup():
    TRANSFER_ROOT.mkdir(parents=True, exist_ok=True)
    ip = get_local_ip()

    banner = f"""
╔══════════════════════════════════════════════╗
║       📸🎬  Photo & Video Transfer           ║
╠══════════════════════════════════════════════╣
║                                              ║
║   On your Android phone, open:               ║
║                                              ║
║     http://{ip:<35}                          ║
║                                              ║
║   Files will be saved to:                    ║
║     {str(TRANSFER_ROOT):<44}                 ║
║                                              ║
║   No internet. No cloud. LAN only. ✓         ║
╚══════════════════════════════════════════════╝
"""
    print(banner)
    logger.info("Transfer root: %s", TRANSFER_ROOT)
    logger.info("Local IP     : %s", ip)


# Entry point

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",   # Listen on all LAN interfaces
        port=8000,
        reload=False,      # Disable in production
        log_level="info",
        # Large file support: 500 MB+ total uploads
        limit_max_requests=None,
    )