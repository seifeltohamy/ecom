"""
automation.py — SSE automation endpoints for Bosta and Chainz export + upload.
"""

import sys
import uuid
import queue
import shutil
import tempfile
import threading
from pathlib import Path

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse

from app.deps import get_db, get_current_user, get_brand_id, require_writable
from app import models
from app.excel_helpers import save_export, load_export, delete_export, process_excel

router = APIRouter()

PROJECT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_DIR / "automation"))


@router.get("/automation/run-export")
def run_export_sse(
    _user:    models.User = Depends(get_current_user),
    brand_id: int = Depends(get_brand_id),
):
    """Stream Bosta export automation progress as SSE."""
    with get_db() as db:
        def _s(key):
            r = db.query(models.AppSettings).filter_by(key=key, brand_id=brand_id).first()
            return r.value if r else None
        bosta_email = _s("bosta_email")
        bosta_pass  = _s("bosta_password")
        email_pass  = _s("bosta_email_password")

    if not all([bosta_email, bosta_pass, email_pass]):
        raise HTTPException(400, "Bosta credentials not configured in Settings")

    q = queue.Queue()

    def _run():
        import bosta_daily as bd
        tmp = tempfile.mkdtemp()
        try:
            q.put("LOG:Logging in to Bosta…")
            bd.trigger_bosta_export(bosta_email, bosta_pass)
            q.put("LOG:Export triggered — waiting for email (up to 5 min)…")
            link = bd.fetch_export_from_email(bosta_email, email_pass)
            q.put("LOG:Download link found — downloading file…")
            path = bd.download_from_link(link, tmp)
            q.put("LOG:File downloaded — sorting rows…")
            out, date_from, date_to = bd.sort_only(path)
            fid = str(uuid.uuid4())
            save_export(fid, {
                "path": out, "tmp": tmp, "brand_id": brand_id,
                "date_from": date_from, "date_to": date_to,
            })
            q.put(f"READY:{fid}:{date_from}:{date_to}")
        except Exception as e:
            q.put(f"ERROR:{e}")
            shutil.rmtree(tmp, ignore_errors=True)

    threading.Thread(target=_run, daemon=True).start()

    def _stream():
        while True:
            try:
                msg = q.get(timeout=15)
            except queue.Empty:
                yield ": keepalive\n\n"
                continue
            yield f"data: {msg}\n\n"
            if msg.startswith("READY:") or msg.startswith("ERROR:"):
                break

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/automation/run-chainz-export")
def run_chainz_export_sse(
    _user:    models.User = Depends(get_current_user),
    brand_id: int = Depends(get_brand_id),
):
    """Stream Chainz export automation progress as SSE."""
    with get_db() as db:
        def _s(key):
            r = db.query(models.AppSettings).filter_by(key=key, brand_id=brand_id).first()
            return r.value if r else None
        chainz_email = _s("chainz_email")
        chainz_pass  = _s("chainz_password")
        email_pass   = _s("bosta_email_password")
        gmail_user   = _s("bosta_email")

    if not all([chainz_email, chainz_pass]):
        raise HTTPException(400, "Chainz portal credentials not configured in Settings")
    if not all([gmail_user, email_pass]):
        raise HTTPException(400, "Gmail IMAP credentials not configured in Settings")

    q = queue.Queue()

    def _run():
        tmp = tempfile.mkdtemp()
        try:
            import chainz_export as ce
            q.put("LOG:Logging in to Chainz portal…")
            ce.trigger_chainz_export(chainz_email, chainz_pass)
            q.put("LOG:Export triggered — waiting for email (up to 5 min)…")
            path = ce.fetch_chainz_email(gmail_user, email_pass)
            q.put("LOG:Attachment downloaded — sorting rows…")
            out, date_from, date_to = ce.sort_chainz_excel(path)
            fid = str(uuid.uuid4())
            save_export(fid, {
                "path": out, "tmp": tmp, "brand_id": brand_id,
                "date_from": date_from, "date_to": date_to,
                "provider": "chainz",
            })
            q.put(f"READY:{fid}:{date_from}:{date_to}")
        except Exception as e:
            q.put(f"ERROR:{e}")
            shutil.rmtree(tmp, ignore_errors=True)

    threading.Thread(target=_run, daemon=True).start()

    def _stream():
        while True:
            try:
                msg = q.get(timeout=15)
            except queue.Empty:
                yield ": keepalive\n\n"
                continue
            yield f"data: {msg}\n\n"
            if msg.startswith("READY:") or msg.startswith("ERROR:"):
                break

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class AutomateUploadBody(BaseModel):
    date_from: str
    date_to:   str


@router.post("/automation/upload/{file_id}")
async def automation_upload(
    file_id:  str,
    body:     AutomateUploadBody,
    _user:    models.User = Depends(require_writable),
    brand_id: int = Depends(get_brand_id),
):
    info = load_export(file_id)
    if not info:
        raise HTTPException(404, "Export session expired or not found")
    if info["brand_id"] != brand_id:
        raise HTTPException(403, "Brand mismatch")
    delete_export(file_id)
    try:
        with open(info["path"], "rb") as f:
            contents = f.read()
        provider = info.get("provider", "bosta")
        report = await process_excel(contents, body.date_from, body.date_to, brand_id, provider=provider)
        return JSONResponse(report)
    finally:
        shutil.rmtree(info.get("tmp", ""), ignore_errors=True)
