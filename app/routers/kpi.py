"""
KPI daily checklist router.

Categories CRUD, items CRUD, check/uncheck, today dashboard, 7-day history.
"""

from datetime import datetime, timedelta
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends

from app.deps import get_db, get_current_user, get_brand_id, require_writable
from app import models

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class CategoryIn(BaseModel):
    name: str
    schedule: str | None = None

class ItemIn(BaseModel):
    title: str

class NotificationEmailIn(BaseModel):
    notification_email: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _full_board(db, brand_id: int, user_id: int, date: str):
    """Return full KPI board for today: categories with items and check status."""
    cats = db.query(models.KpiCategory).filter(
        models.KpiCategory.brand_id == brand_id
    ).order_by(models.KpiCategory.sort_order, models.KpiCategory.id).all()

    checks = set()
    check_rows = db.query(models.KpiCheck).filter(
        models.KpiCheck.brand_id == brand_id,
        models.KpiCheck.user_id == user_id,
        models.KpiCheck.date == date,
    ).all()
    for c in check_rows:
        checks.add(c.item_id)

    total = 0
    completed = 0
    categories = []
    for cat in cats:
        items = []
        for item in sorted(cat.items, key=lambda i: (i.sort_order, i.id)):
            checked = item.id in checks
            items.append({
                "id": item.id,
                "title": item.title,
                "checked": checked,
                "sort_order": item.sort_order,
            })
            total += 1
            if checked:
                completed += 1
        categories.append({
            "id": cat.id,
            "name": cat.name,
            "schedule": cat.schedule,
            "items": items,
        })

    return {
        "categories": categories,
        "total": total,
        "completed": completed,
        "pct": round(completed / total * 100, 1) if total > 0 else 0,
    }


# ── Categories CRUD ──────────────────────────────────────────────────────────

@router.get("/kpi/categories")
def list_categories(brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        cats = db.query(models.KpiCategory).filter(
            models.KpiCategory.brand_id == brand_id
        ).order_by(models.KpiCategory.sort_order, models.KpiCategory.id).all()
        return [
            {"id": c.id, "name": c.name, "schedule": c.schedule, "sort_order": c.sort_order,
             "items": [{"id": i.id, "title": i.title, "sort_order": i.sort_order} for i in sorted(c.items, key=lambda x: (x.sort_order, x.id))]}
            for c in cats
        ]


@router.post("/kpi/categories")
def create_category(body: CategoryIn, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    with get_db() as db:
        existing = db.query(models.KpiCategory).filter(
            models.KpiCategory.brand_id == brand_id,
            models.KpiCategory.name == name,
        ).first()
        if existing:
            raise HTTPException(409, "Category already exists")
        count = db.query(models.KpiCategory).filter(models.KpiCategory.brand_id == brand_id).count()
        cat = models.KpiCategory(brand_id=brand_id, name=name, schedule=body.schedule, sort_order=count)
        db.add(cat)
        db.commit()
        return {"id": cat.id, "name": cat.name, "schedule": cat.schedule}


@router.put("/kpi/categories/{cat_id}")
def update_category(cat_id: int, body: CategoryIn, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
    with get_db() as db:
        cat = db.query(models.KpiCategory).filter(
            models.KpiCategory.id == cat_id, models.KpiCategory.brand_id == brand_id
        ).first()
        if not cat:
            raise HTTPException(404, "Category not found")
        cat.name = body.name.strip()
        cat.schedule = body.schedule
        db.commit()
        return {"id": cat.id, "name": cat.name, "schedule": cat.schedule}


@router.delete("/kpi/categories/{cat_id}")
def delete_category(cat_id: int, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
    with get_db() as db:
        cat = db.query(models.KpiCategory).filter(
            models.KpiCategory.id == cat_id, models.KpiCategory.brand_id == brand_id
        ).first()
        if not cat:
            raise HTTPException(404, "Category not found")
        db.delete(cat)
        db.commit()
    return {"ok": True}


# ── Items CRUD ───────────────────────────────────────────────────────────────

@router.post("/kpi/categories/{cat_id}/items")
def create_item(cat_id: int, body: ItemIn, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
    title = body.title.strip()
    if not title:
        raise HTTPException(400, "Title is required")
    with get_db() as db:
        cat = db.query(models.KpiCategory).filter(
            models.KpiCategory.id == cat_id, models.KpiCategory.brand_id == brand_id
        ).first()
        if not cat:
            raise HTTPException(404, "Category not found")
        count = len(cat.items)
        item = models.KpiItem(category_id=cat_id, title=title, sort_order=count)
        db.add(item)
        db.commit()
        return {"id": item.id, "title": item.title}


@router.put("/kpi/items/{item_id}")
def update_item(item_id: int, body: ItemIn, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
    with get_db() as db:
        item = db.query(models.KpiItem).join(models.KpiCategory).filter(
            models.KpiItem.id == item_id, models.KpiCategory.brand_id == brand_id
        ).first()
        if not item:
            raise HTTPException(404, "Item not found")
        item.title = body.title.strip()
        db.commit()
        return {"id": item.id, "title": item.title}


@router.delete("/kpi/items/{item_id}")
def delete_item(item_id: int, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
    with get_db() as db:
        item = db.query(models.KpiItem).join(models.KpiCategory).filter(
            models.KpiItem.id == item_id, models.KpiCategory.brand_id == brand_id
        ).first()
        if not item:
            raise HTTPException(404, "Item not found")
        db.delete(item)
        db.commit()
    return {"ok": True}


# ── Check / uncheck ──────────────────────────────────────────────────────────

@router.post("/kpi/items/{item_id}/check")
def check_item(item_id: int, brand_id: int = Depends(get_brand_id), user: models.User = Depends(get_current_user)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    with get_db() as db:
        item = db.query(models.KpiItem).join(models.KpiCategory).filter(
            models.KpiItem.id == item_id, models.KpiCategory.brand_id == brand_id
        ).first()
        if not item:
            raise HTTPException(404, "Item not found")
        existing = db.query(models.KpiCheck).filter(
            models.KpiCheck.item_id == item_id,
            models.KpiCheck.user_id == user.id,
            models.KpiCheck.date == today,
        ).first()
        if not existing:
            db.add(models.KpiCheck(
                brand_id=brand_id, item_id=item_id, user_id=user.id, date=today,
            ))
            db.commit()
    return {"ok": True}


@router.delete("/kpi/items/{item_id}/check")
def uncheck_item(item_id: int, brand_id: int = Depends(get_brand_id), user: models.User = Depends(get_current_user)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    with get_db() as db:
        check = db.query(models.KpiCheck).filter(
            models.KpiCheck.item_id == item_id,
            models.KpiCheck.user_id == user.id,
            models.KpiCheck.date == today,
        ).first()
        if check:
            db.delete(check)
            db.commit()
    return {"ok": True}


# ── Dashboard ────────────────────────────────────────────────────────────────

@router.get("/kpi/today")
def kpi_today(brand_id: int = Depends(get_brand_id), user: models.User = Depends(get_current_user)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    with get_db() as db:
        return _full_board(db, brand_id, user.id, today)


@router.get("/kpi/history")
def kpi_history(days: int = 7, brand_id: int = Depends(get_brand_id), user: models.User = Depends(get_current_user)):
    with get_db() as db:
        # Get total items count (assumes items don't change daily — snapshot of current)
        total_items = db.query(models.KpiItem).join(models.KpiCategory).filter(
            models.KpiCategory.brand_id == brand_id
        ).count()

        history = []
        for i in range(days - 1, -1, -1):
            d = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
            completed = db.query(models.KpiCheck).filter(
                models.KpiCheck.brand_id == brand_id,
                models.KpiCheck.user_id == user.id,
                models.KpiCheck.date == d,
            ).count()
            history.append({
                "date": d,
                "total": total_items,
                "completed": completed,
                "pct": round(completed / total_items * 100, 1) if total_items > 0 else 0,
            })

    return history


# ── Notification email ───────────────────────────────────────────────────────

@router.put("/kpi/notification-email")
def set_notification_email(body: NotificationEmailIn, user: models.User = Depends(get_current_user)):
    with get_db() as db:
        u = db.query(models.User).filter(models.User.id == user.id).first()
        if u:
            u.notification_email = (body.notification_email or "").strip() or None
            db.commit()
    return {"ok": True}


@router.get("/kpi/notification-email")
def get_notification_email(user: models.User = Depends(get_current_user)):
    return {"notification_email": user.notification_email or ""}
