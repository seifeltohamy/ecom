import json
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
import httpx

from app.deps import get_db, get_current_user, require_admin, get_brand_id, require_writable
from app import models

router = APIRouter()


class SettingsUpdate(BaseModel):
    bosta_api_key:        str | None = None
    bosta_email:          str | None = None
    bosta_password:       str | None = None
    bosta_email_password: str | None = None


@router.get("/settings")
def get_settings(brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        rows = db.query(models.AppSettings).filter(models.AppSettings.brand_id == brand_id).all()
        data = {r.key: r.value for r in rows}
    return {
        "bosta_api_key":        data.get("bosta_api_key", ""),
        "bosta_email":          data.get("bosta_email", ""),
        "bosta_password":       data.get("bosta_password", ""),
        "bosta_email_password": data.get("bosta_email_password", ""),
    }


@router.put("/settings")
def update_settings(payload: SettingsUpdate, brand_id: int = Depends(get_brand_id), _admin: models.User = Depends(require_admin)):
    updates = {
        "bosta_api_key":        payload.bosta_api_key        or "",
        "bosta_email":          payload.bosta_email           or "",
        "bosta_password":       payload.bosta_password        or "",
        "bosta_email_password": payload.bosta_email_password  or "",
    }
    with get_db() as db:
        for k, v in updates.items():
            row = db.query(models.AppSettings).filter(
                models.AppSettings.key == k, models.AppSettings.brand_id == brand_id
            ).first()
            if row:
                row.value = v
            else:
                db.add(models.AppSettings(key=k, brand_id=brand_id, value=v))
        db.commit()
    return {"ok": True}


# ── Stock Value ───────────────────────────────────────────────────────────────

class StockPurchasePriceIn(BaseModel):
    sku:   str
    price: float


@router.get("/stock-value")
def get_stock_value(brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        setting = db.query(models.AppSettings).filter(
            models.AppSettings.key == "bosta_api_key",
            models.AppSettings.brand_id == brand_id,
        ).first()
        api_key = setting.value if setting else ""

    if not api_key:
        raise HTTPException(status_code=400, detail="Bosta API key not configured. Go to Settings to add it.")

    try:
        h = {"Authorization": api_key}
        products = []
        page = 0
        limit = 100
        while True:
            resp = httpx.get(
                "http://app.bosta.co/api/v2/products/fulfillment/list-products",
                headers=h,
                params={"page": page, "limit": limit},
                timeout=15,
                follow_redirects=True,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Bosta API returned {resp.status_code}: {resp.text[:500]}")
            data = resp.json().get("data", {})
            batch = data.get("data", [])
            products.extend(batch)
            if len(batch) < limit:
                break
            page += 1

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Bosta API: {str(e)}")

    with get_db() as db:
        pp_rows = db.query(models.StockPurchasePrice).filter(
            models.StockPurchasePrice.brand_id == brand_id
        ).all()
        purchase_map = {r.sku: r.purchase_price for r in pp_rows}

        # Latest Bosta report for sell-through / days-remaining metrics
        latest_report = db.query(models.BostaReport).filter(
            models.BostaReport.brand_id == brand_id
        ).order_by(models.BostaReport.uploaded_at.desc()).first()
        qty_map, report_days = {}, 0
        if latest_report:
            report_rows = json.loads(latest_report.rows_json)
            qty_map = {r["sku"]: r.get("total_quantity", 0) for r in report_rows}
            if latest_report.date_from and latest_report.date_to:
                from datetime import date as _date
                d0 = _date.fromisoformat(latest_report.date_from)
                d1 = _date.fromisoformat(latest_report.date_to)
                report_days = max(1, (d1 - d0).days + 1)

    rows = []
    for p in products:
        sku            = p.get("product_code") or str(p.get("id", ""))
        name           = p.get("name") or "Unknown"
        consumer_price = p.get("list_price") or 0
        on_hand        = p.get("qty_available") or 0
        reserved       = p.get("virtual_available") or 0
        purchase_price = purchase_map.get(sku, 0)
        sold           = qty_map.get(sku, 0)

        # Days remaining & sell-through
        if sold > 0 and report_days > 0:
            daily          = sold / report_days
            days_remaining = round(on_hand / daily) if daily > 0 else None
            avg_daily      = round(daily, 2)
        else:
            days_remaining = None
            avg_daily      = 0
        total_units  = sold + on_hand
        sell_through = round(sold / total_units * 100, 1) if total_units > 0 else None

        rows.append({
            "sku":            sku,
            "name":           name,
            "consumer_price": consumer_price,
            "purchase_price": purchase_price,
            "on_hand":        on_hand,
            "reserved":       reserved,
            "consumer_value": round(on_hand * consumer_price, 2),
            "purchase_value": round(on_hand * purchase_price, 2),
            "units_sold":     sold,
            "avg_daily_sales": avg_daily,
            "days_remaining": days_remaining,
            "sell_through":   sell_through,
        })

    capital_trapped = round(sum(
        r["purchase_value"] for r in rows
        if r["sell_through"] is not None and r["sell_through"] < 20
    ), 2)

    return {
        "rows": rows,
        "total_onhand":         sum(r["on_hand"] for r in rows),
        "total_consumer_value": round(sum(r["consumer_value"] for r in rows), 2),
        "total_purchase_value": round(sum(r["purchase_value"] for r in rows), 2),
        "capital_trapped":      capital_trapped,
        "report_days":          report_days,
    }


@router.put("/stock-value/purchase-price")
def upsert_purchase_price(
    body:     StockPurchasePriceIn,
    brand_id: int = Depends(get_brand_id),
    _user:    models.User = Depends(require_writable),
):
    with get_db() as db:
        row = db.query(models.StockPurchasePrice).filter(
            models.StockPurchasePrice.brand_id == brand_id,
            models.StockPurchasePrice.sku      == body.sku,
        ).first()
        if row:
            row.purchase_price = body.price
        else:
            db.add(models.StockPurchasePrice(
                brand_id=brand_id, sku=body.sku, purchase_price=body.price
            ))
        db.commit()
    return {"ok": True}
