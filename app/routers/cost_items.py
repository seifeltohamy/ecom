"""
cost_items.py — SKU cost items CRUD (global per brand/SKU).
"""

from pydantic import BaseModel
from fastapi import APIRouter, Depends

from app.deps import get_db, get_current_user, get_brand_id, require_writable
from app import models

router = APIRouter()


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
    _user:    models.User = Depends(require_writable),
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
