"""
KPI daily checklist router.

Categories CRUD, items CRUD (with per-item time slots),
check/uncheck per slot, today dashboard, 7-day history, test-send.
"""

import json
from datetime import datetime, timedelta
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends

from app.deps import get_db, get_current_user, get_brand_id, require_writable
from app import models

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class CategoryIn(BaseModel):
    name: str

class ItemIn(BaseModel):
    title: str
    times: list[str] | None = None  # ["09:00","12:00","15:00"] or null for once-daily

class NotificationEmailIn(BaseModel):
    notification_email: str | None = None

class CheckBody(BaseModel):
    time_slot: str | None = None  # "09:00" or null


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_times(item) -> list[str | None]:
    """Return list of time slots for an item. [None] for once-daily items."""
    if item.times:
        try:
            parsed = json.loads(item.times)
            if isinstance(parsed, list) and parsed:
                return sorted(parsed)
        except (json.JSONDecodeError, TypeError):
            pass
    return [None]


def _full_board(db, brand_id: int, user_id: int, date: str):
    """Return full KPI board for today: categories with items expanded into time slots."""
    cats = db.query(models.KpiCategory).filter(
        models.KpiCategory.brand_id == brand_id
    ).order_by(models.KpiCategory.sort_order, models.KpiCategory.id).all()

    # Get all checks for this user/date/brand
    check_rows = db.query(models.KpiCheck).filter(
        models.KpiCheck.brand_id == brand_id,
        models.KpiCheck.user_id == user_id,
        models.KpiCheck.date == date,
    ).all()
    checks = {(c.item_id, c.time_slot) for c in check_rows}

    total = 0
    completed = 0
    categories = []
    for cat in cats:
        items = []
        for item in sorted(cat.items, key=lambda i: (i.sort_order, i.id)):
            slots = _get_times(item)
            raw_times = []
            try:
                raw_times = json.loads(item.times) if item.times else []
            except Exception:
                pass
            for slot in slots:
                checked = (item.id, slot) in checks
                items.append({
                    "id": item.id,
                    "title": item.title,
                    "time_slot": slot,
                    "times": raw_times,
                    "checked": checked,
                })
                total += 1
                if checked:
                    completed += 1
        categories.append({
            "id": cat.id,
            "name": cat.name,
            "items": items,
        })

    return {
        "categories": categories,
        "total": total,
        "completed": completed,
        "pct": round(completed / total * 100, 1) if total > 0 else 0,
    }


def _count_total_slots(db, brand_id: int) -> int:
    """Count total time slots across all items for this brand."""
    items = db.query(models.KpiItem).join(models.KpiCategory).filter(
        models.KpiCategory.brand_id == brand_id
    ).all()
    total = 0
    for item in items:
        total += len(_get_times(item))
    return total


# ── Categories CRUD ──────────────────────────────────────────────────────────

@router.get("/kpi/categories")
def list_categories(brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    with get_db() as db:
        cats = db.query(models.KpiCategory).filter(
            models.KpiCategory.brand_id == brand_id
        ).order_by(models.KpiCategory.sort_order, models.KpiCategory.id).all()
        return [
            {"id": c.id, "name": c.name, "sort_order": c.sort_order,
             "items": [{"id": i.id, "title": i.title, "times": json.loads(i.times) if i.times else [], "sort_order": i.sort_order}
                       for i in sorted(c.items, key=lambda x: (x.sort_order, x.id))]}
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
        cat = models.KpiCategory(brand_id=brand_id, name=name, sort_order=count)
        db.add(cat)
        db.commit()
        return {"id": cat.id, "name": cat.name}


@router.put("/kpi/categories/{cat_id}")
def update_category(cat_id: int, body: CategoryIn, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
    with get_db() as db:
        cat = db.query(models.KpiCategory).filter(
            models.KpiCategory.id == cat_id, models.KpiCategory.brand_id == brand_id
        ).first()
        if not cat:
            raise HTTPException(404, "Category not found")
        cat.name = body.name.strip()
        db.commit()
        return {"id": cat.id, "name": cat.name}


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
        times_json = json.dumps(body.times) if body.times else None
        item = models.KpiItem(category_id=cat_id, title=title, times=times_json, sort_order=count)
        db.add(item)
        db.commit()
        return {"id": item.id, "title": item.title, "times": body.times or []}


@router.put("/kpi/items/{item_id}")
def update_item(item_id: int, body: ItemIn, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(require_writable)):
    with get_db() as db:
        item = db.query(models.KpiItem).join(models.KpiCategory).filter(
            models.KpiItem.id == item_id, models.KpiCategory.brand_id == brand_id
        ).first()
        if not item:
            raise HTTPException(404, "Item not found")
        item.title = body.title.strip()
        item.times = json.dumps(body.times) if body.times else None
        db.commit()
        return {"id": item.id, "title": item.title, "times": body.times or []}


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
def check_item(item_id: int, time_slot: str | None = None, brand_id: int = Depends(get_brand_id), user: models.User = Depends(get_current_user)):
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
            models.KpiCheck.time_slot == time_slot,
        ).first()
        if not existing:
            db.add(models.KpiCheck(
                brand_id=brand_id, item_id=item_id, user_id=user.id,
                date=today, time_slot=time_slot,
            ))
            db.commit()
    return {"ok": True}


@router.delete("/kpi/items/{item_id}/check")
def uncheck_item(item_id: int, time_slot: str | None = None, brand_id: int = Depends(get_brand_id), user: models.User = Depends(get_current_user)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    with get_db() as db:
        check = db.query(models.KpiCheck).filter(
            models.KpiCheck.item_id == item_id,
            models.KpiCheck.user_id == user.id,
            models.KpiCheck.date == today,
            models.KpiCheck.time_slot == time_slot,
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
        total_slots = _count_total_slots(db, brand_id)

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
                "total": total_slots,
                "completed": min(completed, total_slots),
                "pct": round(min(completed, total_slots) / total_slots * 100, 1) if total_slots > 0 else 0,
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


# ── Test send ────────────────────────────────────────────────────────────────

@router.post("/kpi/test-send")
def test_send(brand_id: int = Depends(get_brand_id), user: models.User = Depends(get_current_user)):
    """Send a test reminder email to the current user's notification_email."""
    if not user.notification_email:
        raise HTTPException(400, "No notification email set. Enter your email above and save first.")

    from app.kpi_reminder import _build_reminder_html
    from app.stock_alert import _send_email

    today = datetime.utcnow().strftime("%Y-%m-%d")
    with get_db() as db:
        brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
        brand_name = brand.name if brand else "Unknown"

        # Find all pending items/slots for today
        cats = db.query(models.KpiCategory).filter(
            models.KpiCategory.brand_id == brand_id
        ).all()

        checked = {
            (c.item_id, c.time_slot)
            for c in db.query(models.KpiCheck).filter(
                models.KpiCheck.brand_id == brand_id,
                models.KpiCheck.user_id == user.id,
                models.KpiCheck.date == today,
            ).all()
        }

        pending_items = []
        for cat in cats:
            for item in cat.items:
                slots = _get_times(item)
                for slot in slots:
                    if (item.id, slot) not in checked:
                        label = item.title
                        if slot:
                            h, m = slot.split(":")
                            hr = int(h)
                            ampm = "AM" if hr < 12 else "PM"
                            label += f" — {hr % 12 or 12}:{m} {ampm}"
                        pending_items.append(label)

    if not pending_items:
        pending_items = ["(All items completed — this is a test email)"]

    subject = f"📋 KPI Reminder — {len(pending_items)} pending ({brand_name})"
    html = _build_reminder_html(brand_name, "Daily Checklist", pending_items)

    try:
        _send_email(user.notification_email, "", subject, html)
        return {"ok": True, "sent_to": user.notification_email, "pending_count": len(pending_items)}
    except Exception as e:
        raise HTTPException(500, f"Failed to send: {e}")
