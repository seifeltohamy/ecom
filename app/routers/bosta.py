import re
import io
import json
import sys
import uuid
import queue
import shutil
import tempfile
import threading
from collections import defaultdict
from datetime import datetime as _dt
from pathlib import Path

import openpyxl
from pydantic import BaseModel
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse

from app.deps import get_db, get_current_user, get_brand_id
from app import models
from sqlalchemy.orm import Session

router = APIRouter()

PROJECT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_DIR / "automation"))

# file_id → {path, tmp, brand_id, date_from, date_to}
pending_exports: dict = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_products_map(db: Session, brand_id: int) -> dict:
    products = db.query(models.Product).filter(models.Product.brand_id == brand_id).all()
    return {p.sku: p.name for p in products}


def parse_description_text(text: str) -> list[tuple]:
    """Extract (sku, quantity, price) tuples from a Description cell."""
    pattern = r"BostaSKU:(BO-\d+)\s*-\s*quantity:(\d+)\s*-\s*itemPrice:([\d.]+)"
    return re.findall(pattern, text)


def aggregate_excel(workbook, date_from: str = None, date_to: str = None) -> dict:
    from datetime import datetime, date

    ws = workbook.active
    headers = [cell.value for cell in ws[1]]

    try:
        desc_idx = headers.index("Description")
    except ValueError:
        raise HTTPException(status_code=400, detail="No 'Description' column found in Excel.")

    headers_lower = [str(h).strip().lower() if h else "" for h in headers]
    if "delivered at" in headers_lower:
        deliv_idx = headers_lower.index("delivered at")
    else:
        deliv_idx = next(
            (i for i, h in enumerate(headers_lower) if h == "delivered at"),
            None
        )

    dt_from = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else None
    dt_to   = datetime.strptime(date_to,   "%Y-%m-%d").date() if date_to   else None

    sku_data = defaultdict(lambda: defaultdict(lambda: {"quantity": 0, "total": 0.0}))
    order_count = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        if deliv_idx is not None and (dt_from or dt_to):
            raw = row[deliv_idx]
            if raw is None:
                continue
            if isinstance(raw, (datetime, date)):
                row_date = raw.date() if isinstance(raw, datetime) else raw
            else:
                raw_str = str(raw).strip()
                parsed = None
                for fmt in ("%m-%d-%Y, %H:%M:%S", "%m-%d-%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                    try:
                        parsed = datetime.strptime(raw_str, fmt).date()
                        break
                    except ValueError:
                        continue
                if parsed is None:
                    continue
                row_date = parsed
            if dt_from and row_date < dt_from:
                continue
            if dt_to   and row_date > dt_to:
                continue

        cell = row[desc_idx]
        if not cell:
            continue
        matches = parse_description_text(str(cell))
        if matches:
            order_count += 1
            for sku, qty_str, price_str in matches:
                qty = int(qty_str)
                price = float(price_str)
                sku_data[sku][price]["quantity"] += qty
                sku_data[sku][price]["total"] += qty * price

    return sku_data, order_count


def build_report(sku_data: dict, products: dict, order_count: int = 0) -> dict:
    rows = []
    grand_qty = 0
    grand_rev = 0.0

    product_order = {sku: i for i, sku in enumerate(products.keys())}

    def sort_key(sku):
        return (product_order.get(sku, 9999), -sum(v["total"] for v in sku_data[sku].values()))

    for sku in sorted(sku_data.keys(), key=sort_key):
        name = products.get(sku, "Unknown Product")
        price_breakdown = []
        sku_qty = 0
        sku_rev = 0.0

        for price in sorted(sku_data[sku].keys(), reverse=True):
            d = sku_data[sku][price]
            price_breakdown.append({
                "price": price,
                "quantity": d["quantity"],
                "total": round(d["total"], 2),
            })
            sku_qty += d["quantity"]
            sku_rev += d["total"]

        rows.append({
            "sku": sku,
            "name": name,
            "prices": price_breakdown,
            "total_quantity": sku_qty,
            "total_revenue": round(sku_rev, 2),
        })

        grand_qty += sku_qty
        grand_rev += sku_rev

    return {
        "rows": rows,
        "grand_quantity": grand_qty,
        "grand_revenue": round(grand_rev, 2),
        "order_count": order_count,
    }


async def _process_excel(contents: bytes, date_from: str | None, date_to: str | None, brand_id: int) -> dict:
    """Core Excel processing logic shared by /upload and /automation/upload/{file_id}."""
    wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
    sku_data, order_count = aggregate_excel(wb, date_from=date_from, date_to=date_to)
    with get_db() as db:
        products = get_products_map(db, brand_id)
    report = build_report(sku_data, products, order_count)
    with get_db() as db:
        saved = models.BostaReport(
            uploaded_at    = _dt.utcnow(),
            date_from      = date_from or None,
            date_to        = date_to   or None,
            order_count    = report["order_count"],
            grand_quantity = report["grand_quantity"],
            grand_revenue  = report["grand_revenue"],
            rows_json      = json.dumps(report["rows"]),
            brand_id       = brand_id,
        )
        db.add(saved)
        db.commit()
        db.refresh(saved)
        report["report_id"] = saved.id
    return report


# ── Routes ────────────────────────────────────────────────────────────────────

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


@router.post("/upload")
async def upload_excel(
    file: UploadFile = File(...),
    date_from: str = Form(None),
    date_to:   str = Form(None),
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(get_current_user),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Please upload an Excel file (.xlsx or .xls).")
    contents = await file.read()
    report = await _process_excel(contents, date_from, date_to, brand_id)
    return JSONResponse(report)


# ── Reports ───────────────────────────────────────────────────────────────────

@router.get("/reports")
def list_reports(brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        reports = db.query(models.BostaReport).filter(
            models.BostaReport.brand_id == brand_id
        ).order_by(models.BostaReport.uploaded_at.desc()).all()
        return [
            {
                "id": r.id,
                "uploaded_at": r.uploaded_at.isoformat(),
                "date_from": r.date_from,
                "date_to": r.date_to,
                "order_count": r.order_count,
                "grand_quantity": r.grand_quantity,
                "grand_revenue": r.grand_revenue,
            }
            for r in reports
        ]


@router.get("/reports/{report_id}")
def get_report(report_id: int, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        r = db.query(models.BostaReport).filter(
            models.BostaReport.id == report_id, models.BostaReport.brand_id == brand_id
        ).first()
        if not r:
            raise HTTPException(status_code=404, detail="Report not found.")
        return {
            "report_id": r.id,
            "id": r.id,
            "uploaded_at": r.uploaded_at.isoformat(),
            "date_from": r.date_from,
            "date_to": r.date_to,
            "order_count": r.order_count,
            "grand_quantity": r.grand_quantity,
            "grand_revenue": r.grand_revenue,
            "rows": json.loads(r.rows_json),
        }


@router.get("/reports/{report_id}/pl")
def get_report_pl(report_id: int, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        r = db.query(models.BostaReport).filter(
            models.BostaReport.id == report_id, models.BostaReport.brand_id == brand_id
        ).first()
        if not r:
            raise HTTPException(status_code=404, detail="Report not found.")
        items = db.query(models.BostaReportPl).filter(
            models.BostaReportPl.report_id == report_id
        ).all()
        return {
            "ads_spent": r.ads_spent,
            "items": [
                {
                    "sku": i.sku, "price": i.price,
                    "cost": i.cost, "extra_cost": i.extra_cost,
                    "cost_formula": i.cost_formula, "extra_cost_formula": i.extra_cost_formula,
                }
                for i in items
            ],
        }


class ReportPlItem(BaseModel):
    sku:                str
    price:              float | None = None
    cost:               float | None = None
    extra_cost:         float | None = None
    cost_formula:       str   | None = None
    extra_cost_formula: str   | None = None

class ReportPlPayload(BaseModel):
    ads_spent: float | None = None
    items:     list[ReportPlItem] = []


@router.put("/reports/{report_id}/pl")
def save_report_pl(report_id: int, payload: ReportPlPayload, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        r = db.query(models.BostaReport).filter(
            models.BostaReport.id == report_id, models.BostaReport.brand_id == brand_id
        ).first()
        if not r:
            raise HTTPException(status_code=404, detail="Report not found.")
        r.ads_spent = payload.ads_spent
        for item in payload.items:
            row = db.query(models.BostaReportPl).filter(
                models.BostaReportPl.report_id == report_id,
                models.BostaReportPl.sku == item.sku,
            ).first()
            if row:
                row.price              = item.price
                row.cost               = item.cost
                row.extra_cost         = item.extra_cost
                row.cost_formula       = item.cost_formula
                row.extra_cost_formula = item.extra_cost_formula
            else:
                db.add(models.BostaReportPl(
                    report_id=report_id, sku=item.sku,
                    price=item.price, cost=item.cost, extra_cost=item.extra_cost,
                    cost_formula=item.cost_formula, extra_cost_formula=item.extra_cost_formula,
                ))
        db.commit()
    return {"ok": True}


# ── Automation ────────────────────────────────────────────────────────────────

@router.get("/automation/run-export")
def run_export_sse(
    _user:    models.User = Depends(get_current_user),
    brand_id: int = Depends(get_brand_id),
):
    """Stream Bosta export automation progress as SSE. Reads credentials from app_settings."""
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
            pending_exports[fid] = {
                "path": out, "tmp": tmp, "brand_id": brand_id,
                "date_from": date_from, "date_to": date_to,
            }
            q.put(f"READY:{fid}:{date_from}:{date_to}")
        except Exception as e:
            q.put(f"ERROR:{e}")
            shutil.rmtree(tmp, ignore_errors=True)

    threading.Thread(target=_run, daemon=True).start()

    def _stream():
        while True:
            msg = q.get()
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
    _user:    models.User = Depends(get_current_user),
    brand_id: int = Depends(get_brand_id),
):
    info = pending_exports.pop(file_id, None)
    if not info:
        raise HTTPException(404, "Export session expired or not found")
    if info["brand_id"] != brand_id:
        raise HTTPException(403, "Brand mismatch")
    try:
        with open(info["path"], "rb") as f:
            contents = f.read()
        report = await _process_excel(contents, body.date_from, body.date_to, brand_id)
        return JSONResponse(report)
    finally:
        shutil.rmtree(info["tmp"], ignore_errors=True)


# ── SKU Cost Items ────────────────────────────────────────────────────────────

@router.get("/sku-cost-items")
def get_all_sku_cost_items(
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(get_current_user),
):
    """Return all cost items for this brand, grouped by SKU: { sku: [{name, amount}] }"""
    with get_db() as db:
        rows = db.query(models.SkuCostItem).filter(
            models.SkuCostItem.brand_id == brand_id
        ).all()
    result: dict = {}
    for r in rows:
        result.setdefault(r.sku, []).append({"name": r.name, "amount": r.amount})
    return result


class CostItemIn(BaseModel):
    name:   str
    amount: float

class CostItemsBody(BaseModel):
    items: list[CostItemIn]


@router.put("/sku-cost-items/{sku}")
def upsert_sku_cost_items(
    sku:      str,
    body:     CostItemsBody,
    brand_id: int = Depends(get_brand_id),
    _user:    models.User = Depends(get_current_user),
):
    """Full replace: delete existing items for (brand_id, sku), then insert new ones."""
    with get_db() as db:
        db.query(models.SkuCostItem).filter(
            models.SkuCostItem.brand_id == brand_id,
            models.SkuCostItem.sku      == sku,
        ).delete()
        for item in body.items:
            db.add(models.SkuCostItem(
                brand_id=brand_id,
                sku=sku,
                name=item.name.strip(),
                amount=item.amount,
            ))
        db.commit()
    return {"ok": True}
