from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends

from app.deps import get_db, get_current_user, get_brand_id
from app import models, schemas

router = APIRouter()


@router.get("/cashflow/months")
def get_cashflow_months(brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        months = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.brand_id == brand_id
        ).order_by(models.CashflowMonth.created_at).all()
        return [m.name for m in months]


@router.post("/cashflow/months")
def add_cashflow_month(payload: schemas.CashflowMonthIn, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    month = payload.month.strip()
    if not month:
        raise HTTPException(status_code=400, detail="Month is required.")
    with get_db() as db:
        existing = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.name == month, models.CashflowMonth.brand_id == brand_id
        ).first()
        if not existing:
            db.add(models.CashflowMonth(name=month, brand_id=brand_id))
            db.commit()
        months = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.brand_id == brand_id
        ).order_by(models.CashflowMonth.created_at).all()
        return {"ok": True, "months": [m.name for m in months]}


@router.get("/cashflow/{month}")
def get_cashflow_month(month: str, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        m = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.name == month, models.CashflowMonth.brand_id == brand_id
        ).first()
        if not m:
            return []
        rows = db.query(models.CashflowEntry).filter(
            models.CashflowEntry.month_id == m.id
        ).order_by(models.CashflowEntry.created_at).all()
        return [
            {"id": r.id, "date": r.date, "type": r.type, "amount": r.amount,
             "category": r.category, "notes": r.notes or ""}
            for r in rows
        ]


@router.post("/cashflow/{month}/entries")
def add_cashflow_entry(month: str, entry: schemas.CashflowEntryIn, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        m = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.name == month, models.CashflowMonth.brand_id == brand_id
        ).first()
        if not m:
            m = models.CashflowMonth(name=month, brand_id=brand_id)
            db.add(m)
            db.commit()
            db.refresh(m)
        row = models.CashflowEntry(
            month_id=m.id, date=entry.date, type=entry.type,
            amount=entry.amount, category=entry.category, notes=entry.notes,
        )
        db.add(row)
        db.commit()
        rows = db.query(models.CashflowEntry).filter(
            models.CashflowEntry.month_id == m.id
        ).order_by(models.CashflowEntry.created_at).all()
        return {"ok": True, "rows": [
            {"id": r.id, "date": r.date, "type": r.type, "amount": r.amount,
             "category": r.category, "notes": r.notes or ""}
            for r in rows
        ]}


@router.delete("/cashflow/{month}/entries/{entry_id}")
def delete_cashflow_entry(month: str, entry_id: int, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        m = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.name == month, models.CashflowMonth.brand_id == brand_id
        ).first()
        if not m:
            raise HTTPException(status_code=404, detail="Month not found.")
        row = db.query(models.CashflowEntry).filter(
            models.CashflowEntry.month_id == m.id, models.CashflowEntry.id == entry_id
        ).first()
        if not row:
            raise HTTPException(status_code=404, detail="Entry not found.")
        db.add(models.DeletedCashflowEntry(
            id=row.id, month_name=month, date=row.date, type=row.type,
            amount=row.amount, category=row.category, notes=row.notes or "",
            brand_id=brand_id,
        ))
        db.delete(row)
        db.commit()
        rows = db.query(models.CashflowEntry).filter(
            models.CashflowEntry.month_id == m.id
        ).order_by(models.CashflowEntry.created_at).all()
        return {"ok": True, "rows": [
            {"id": r.id, "date": r.date, "type": r.type, "amount": r.amount,
             "category": r.category, "notes": r.notes or ""}
            for r in rows
        ]}


@router.put("/cashflow/{month}/entries/{entry_id}")
def update_cashflow_entry(month: str, entry_id: int, entry: schemas.CashflowEntryUpdate, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        m = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.name == month, models.CashflowMonth.brand_id == brand_id
        ).first()
        if not m:
            raise HTTPException(status_code=404, detail="Month not found.")
        row = db.query(models.CashflowEntry).filter(
            models.CashflowEntry.month_id == m.id, models.CashflowEntry.id == entry_id
        ).first()
        if not row:
            raise HTTPException(status_code=404, detail="Entry not found.")
        row.date = entry.date; row.type = entry.type; row.amount = entry.amount
        row.category = entry.category; row.notes = entry.notes
        db.commit()
        rows = db.query(models.CashflowEntry).filter(
            models.CashflowEntry.month_id == m.id
        ).order_by(models.CashflowEntry.created_at).all()
        return {"ok": True, "rows": [
            {"id": r.id, "date": r.date, "type": r.type, "amount": r.amount,
             "category": r.category, "notes": r.notes or ""}
            for r in rows
        ]}


# ── Cashflow categories ───────────────────────────────────────────────────────

class CategoryIn(BaseModel):
    type: str   # 'in' | 'out'
    name: str

class CategoryReorder(BaseModel):
    ids: list[int]


@router.get("/categories")
def list_categories(brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        cats = db.query(models.CashflowCategory).filter(
            models.CashflowCategory.brand_id == brand_id
        ).order_by(models.CashflowCategory.type, models.CashflowCategory.sort_order, models.CashflowCategory.name).all()
        return [{"id": c.id, "type": c.type, "name": c.name, "sort_order": c.sort_order} for c in cats]


@router.post("/categories")
def create_category(payload: CategoryIn, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    if payload.type not in ("in", "out"):
        raise HTTPException(status_code=400, detail="type must be 'in' or 'out'")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    with get_db() as db:
        existing = db.query(models.CashflowCategory).filter(
            models.CashflowCategory.brand_id == brand_id,
            models.CashflowCategory.type == payload.type,
            models.CashflowCategory.name == name,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Category already exists")
        max_order = db.query(models.CashflowCategory).filter(
            models.CashflowCategory.brand_id == brand_id,
            models.CashflowCategory.type == payload.type,
        ).count()
        cat = models.CashflowCategory(brand_id=brand_id, type=payload.type, name=name, sort_order=max_order)
        db.add(cat)
        db.commit()
        return {"id": cat.id, "type": cat.type, "name": cat.name, "sort_order": cat.sort_order}


@router.put("/categories/{cat_id}")
def rename_category(cat_id: int, payload: CategoryIn, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    with get_db() as db:
        cat = db.query(models.CashflowCategory).filter(
            models.CashflowCategory.id == cat_id,
            models.CashflowCategory.brand_id == brand_id,
        ).first()
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")
        cat.name = name
        db.commit()
        return {"id": cat.id, "type": cat.type, "name": cat.name, "sort_order": cat.sort_order}


@router.delete("/categories/{cat_id}")
def delete_category(cat_id: int, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        cat = db.query(models.CashflowCategory).filter(
            models.CashflowCategory.id == cat_id,
            models.CashflowCategory.brand_id == brand_id,
        ).first()
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")
        db.delete(cat)
        db.commit()
    return {"ok": True}


@router.put("/categories/reorder/{type}")
def reorder_categories(type: str, payload: CategoryReorder, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        for order, cat_id in enumerate(payload.ids):
            db.query(models.CashflowCategory).filter(
                models.CashflowCategory.id == cat_id,
                models.CashflowCategory.brand_id == brand_id,
                models.CashflowCategory.type == type,
            ).update({"sort_order": order})
        db.commit()
    return {"ok": True}
