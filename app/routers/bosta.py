"""
bosta.py — Upload routes (debug-upload, upload/prepare, upload).

Parsing logic and report building are in app/excel_helpers.py.
Reports, automation, and cost items have their own router files.
"""

import io
import os
import sys
import uuid
import shutil
import tempfile
from datetime import datetime as _dt
from pathlib import Path

import openpyxl
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse

from app.deps import get_db, get_brand_id, require_writable
from app import models
from app.excel_helpers import save_export, process_excel

router = APIRouter()

PROJECT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_DIR / "automation"))


@router.post("/debug-upload")
async def debug_upload(file: UploadFile = File(...)):
    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
    ws = wb.active
    headers = [cell.value for cell in ws[1]]

    headers_lower = [str(h).strip().lower() if h else "" for h in headers]
    deliv_idx = headers_lower.index("delivered at") if "delivered at" in headers_lower else None

    samples = []
    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
        if i >= 10:
            break
        raw = row[deliv_idx] if deliv_idx is not None else "column not found"
        samples.append({"raw": str(raw), "type": type(raw).__name__})

    return {"headers": headers, "delivered_at_index": deliv_idx, "samples": samples}


@router.post("/upload/prepare")
async def upload_prepare(
    file: UploadFile = File(...),
    provider: str = Form("bosta"),
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(require_writable),
):
    """Sort the uploaded file and detect its date range without processing it yet."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Please upload an Excel file (.xlsx or .xls).")
    contents = await file.read()
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, "upload.xlsx")
    with open(path, "wb") as f:
        f.write(contents)

    if provider == "chainz":
        try:
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            ws = wb.active
            headers = [str(cell.value or "").strip() for cell in ws[1]]
            idx = headers.index("Ordered At") if "Ordered At" in headers else None
            dates = []
            if idx is not None:
                for row in ws.iter_rows(min_row=2, values_only=True):
                    raw = row[idx]
                    if raw is None:
                        continue
                    if isinstance(raw, _dt):
                        dates.append(raw.date())
                    else:
                        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                            try:
                                dates.append(_dt.strptime(str(raw).strip(), fmt).date())
                                break
                            except ValueError:
                                continue
            date_from = min(dates).strftime("%Y-%m-%d") if dates else None
            date_to = max(dates).strftime("%Y-%m-%d") if dates else None
        except Exception as e:
            shutil.rmtree(tmp, ignore_errors=True)
            raise HTTPException(status_code=400, detail=str(e))
    else:
        try:
            import bosta_daily as bd
            path, date_from, date_to = bd.sort_only(path)
        except Exception as e:
            shutil.rmtree(tmp, ignore_errors=True)
            raise HTTPException(status_code=400, detail=str(e))

    fid = str(uuid.uuid4())
    save_export(fid, {"path": path, "tmp": tmp, "brand_id": brand_id,
                      "date_from": date_from, "date_to": date_to, "provider": provider})
    return {"file_id": fid, "date_from": date_from, "date_to": date_to}


@router.post("/upload")
async def upload_excel(
    file: UploadFile = File(...),
    date_from: str = Form(None),
    date_to:   str = Form(None),
    provider:  str = Form("bosta"),
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(require_writable),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Please upload an Excel file (.xlsx or .xls).")
    contents = await file.read()
    report = await process_excel(contents, date_from, date_to, brand_id, provider=provider)
    return JSONResponse(report)
