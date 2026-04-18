import json
from datetime import datetime as _dt

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends

from app.deps import get_db, get_current_user, get_brand_id, require_writable
from app import models, schemas

router = APIRouter()


@router.get("/products")
def get_products(brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        products = db.query(models.Product).filter(models.Product.brand_id == brand_id).all()
        return {p.sku: {"name": p.name, "price": p.price} for p in products}


@router.post("/products")
def add_product(product: schemas.ProductIn, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
    sku = product.sku.strip()
    name = product.name.strip()
    if not sku or not name:
        raise HTTPException(status_code=400, detail="SKU and name are required.")
    with get_db() as db:
        existing = db.query(models.Product).filter(
            models.Product.sku == sku, models.Product.brand_id == brand_id
        ).first()
        if existing:
            existing.name = name
            if product.price is not None:
                existing.price = product.price
        else:
            db.add(models.Product(sku=sku, name=name, brand_id=brand_id, price=product.price))
        db.commit()
    return {"ok": True, "sku": sku, "name": name, "price": product.price}


@router.delete("/products/{sku}")
def delete_product(sku: str, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
    with get_db() as db:
        product = db.query(models.Product).filter(
            models.Product.sku == sku, models.Product.brand_id == brand_id
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail="SKU not found.")
        db.delete(product)
        db.commit()
    return {"ok": True}


# ── Products Sold ─────────────────────────────────────────────────────────────

def _calc_profit(revenue, cost, qty, extra_cost, expense):
    profit = revenue - (cost or 0) * qty - (extra_cost or 0) - (expense or 0)
    profit_pct = round(profit / revenue * 100, 2) if revenue else 0.0
    return round(profit, 2), profit_pct


@router.get("/products-sold/{month}")
def get_products_sold(month: str, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    try:
        dt = _dt.strptime(month, "%b %Y")
        prefix = dt.strftime("%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use 'Mar 2026'.")

    with get_db() as db:
        m = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.name == month, models.CashflowMonth.brand_id == brand_id
        ).first()
        if not m:
            raise HTTPException(status_code=404, detail="Month not found.")

        report = (
            db.query(models.BostaReport)
            .filter(
                models.BostaReport.brand_id == brand_id,
                models.BostaReport.date_from.like(f"{prefix}%"),
            )
            .order_by(models.BostaReport.uploaded_at.desc())
            .first()
        )
        bosta_by_sku = {}
        if report:
            for row in json.loads(report.rows_json):
                bosta_by_sku[row["sku"]] = {
                    "qty": row.get("total_quantity", 0),
                    "revenue": row.get("total_revenue", 0.0),
                }

        products = db.query(models.Product).filter(models.Product.brand_id == brand_id).all()
        manual_rows = {
            r.sku: r
            for r in db.query(models.ProductsSoldManual)
            .filter(models.ProductsSoldManual.month_id == m.id)
            .all()
        }

        result = []
        for p in products:
            b = bosta_by_sku.get(p.sku, {"qty": 0, "revenue": 0.0})
            man = manual_rows.get(p.sku)
            price      = man.price      if man else None
            cost       = man.cost       if man else None
            extra_cost = man.extra_cost if man else None
            expense    = man.expense    if man else None
            profit, profit_pct = _calc_profit(b["revenue"], cost, b["qty"], extra_cost, expense)
            result.append({
                "sku": p.sku, "name": p.name, "price": price, "cost": cost,
                "extra_cost": extra_cost, "qty": b["qty"], "revenue": b["revenue"],
                "expense": expense, "profit": profit, "profit_pct": profit_pct,
            })
        return result


class ProductsSoldUpdate(BaseModel):
    price:      float | None = None
    cost:       float | None = None
    extra_cost: float | None = None
    expense:    float | None = None


@router.put("/products-sold/{month}/{sku}")
def update_products_sold(month: str, sku: str, payload: ProductsSoldUpdate,
                         brand_id: int = Depends(get_brand_id),
                         _user: models.User = Depends(require_writable)):
    with get_db() as db:
        m = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.name == month, models.CashflowMonth.brand_id == brand_id
        ).first()
        if not m:
            raise HTTPException(status_code=404, detail="Month not found.")

        row = (
            db.query(models.ProductsSoldManual)
            .filter(models.ProductsSoldManual.month_id == m.id,
                    models.ProductsSoldManual.sku == sku)
            .first()
        )
        if row is None:
            row = models.ProductsSoldManual(month_id=m.id, sku=sku)
            db.add(row)

        row.price = payload.price; row.cost = payload.cost
        row.extra_cost = payload.extra_cost; row.expense = payload.expense
        db.commit()
    return {"ok": True}
