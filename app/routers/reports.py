"""
reports.py — Reports CRUD + P&L save/load.
"""

import json
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends

from app.deps import get_db, get_current_user, get_brand_id, require_writable
from app import models
from app.excel_helpers import get_products_map

router = APIRouter()


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


@router.delete("/reports/{report_id}")
def delete_report(report_id: int, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
    with get_db() as db:
        r = db.query(models.BostaReport).filter(
            models.BostaReport.id == report_id, models.BostaReport.brand_id == brand_id
        ).first()
        if not r:
            raise HTTPException(status_code=404, detail="Report not found.")
        db.delete(r)
        db.commit()
    return {"ok": True}


@router.get("/reports/{report_id}")
def get_report(report_id: int, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        r = db.query(models.BostaReport).filter(
            models.BostaReport.id == report_id, models.BostaReport.brand_id == brand_id
        ).first()
        if not r:
            raise HTTPException(status_code=404, detail="Report not found.")
        rows = json.loads(r.rows_json)
        products_map = get_products_map(db, brand_id)

        # Auto-fetch Shopify names for unknown products
        unknown_skus = [row.get("sku") for row in rows
                        if row.get("name") == "Unknown Product" and products_map.get(row.get("sku"), "Unknown Product") == "Unknown Product"]
        if unknown_skus:
            settings = {s.key: s.value for s in db.query(models.AppSettings).filter(
                models.AppSettings.brand_id == brand_id).all()}
            store_url = settings.get("shopify_store_url", "")
            access_token = settings.get("shopify_access_token", "")
            if store_url and access_token:
                try:
                    from app.shopify_client import get_product_names_by_sku
                    shopify_names = get_product_names_by_sku(store_url, access_token)
                    for sku in unknown_skus:
                        name = shopify_names.get(sku)
                        if name:
                            existing = db.query(models.Product).filter(
                                models.Product.sku == sku, models.Product.brand_id == brand_id
                            ).first()
                            if existing and existing.name == "Unknown Product":
                                existing.name = name
                            elif not existing:
                                db.add(models.Product(sku=sku, name=name, brand_id=brand_id))
                            products_map[sku] = name
                    db.commit()
                except Exception:
                    pass

        for row in rows:
            saved = products_map.get(row.get("sku"))
            if saved:
                row["name"] = saved
        return {
            "report_id": r.id,
            "id": r.id,
            "uploaded_at": r.uploaded_at.isoformat(),
            "date_from": r.date_from,
            "date_to": r.date_to,
            "order_count": r.order_count,
            "grand_quantity": r.grand_quantity,
            "grand_revenue": r.grand_revenue,
            "rows": rows,
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
def save_report_pl(report_id: int, payload: ReportPlPayload, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
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
