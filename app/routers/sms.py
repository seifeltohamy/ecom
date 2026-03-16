"""
Bank SMS intake and cashflow suggestion endpoints.

POST /sms/intake?token=xxx          — no JWT, token-gated; called by iOS Shortcut
GET  /sms/token                     — admin; returns/creates webhook token for brand
GET  /cashflow/sms-suggestions      — auth; returns pending suggestions for brand
POST /cashflow/sms-suggestions/{id}/accept  — writable; creates CashflowEntry
POST /cashflow/sms-suggestions/{id}/dismiss — auth; marks dismissed
"""

import re
import secrets
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.deps import get_db, get_current_user, get_brand_id, require_writable, require_admin
from app import models

router = APIRouter()


# ── CIB SMS parser ─────────────────────────────────────────────────────────────

def parse_cib_sms(text: str) -> dict | None:
    """Parse a CIB bank deduction SMS. Returns dict or None if unrecognised."""
    if not text:
        return None
    # Must look like a CIB deduction message
    is_cib = "19666" in text or "تم خصم" in text or "تم تنفيذ" in text
    if not is_cib:
        return None

    # ── Amount ────────────────────────────────────────────────────────────────
    m_egp = re.search(r'EGP\s*([\d,]+\.?\d*)', text)
    m_jm  = re.search(r'بمبلغ\s*([\d,]+\.?\d*)\s*جم', text)
    raw   = m_egp or m_jm
    if not raw:
        return None
    amount = float(raw.group(1).replace(',', ''))

    # ── Date (DD-MM-YYYY HH:MM) ───────────────────────────────────────────────
    m_date = re.search(r'بتاريخ\s*(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})', text)
    if m_date:
        try:
            tx_date = datetime.strptime(m_date.group(1).strip(), "%d-%m-%Y %H:%M")
        except ValueError:
            tx_date = datetime.utcnow()
    else:
        tx_date = datetime.utcnow()

    # ── Ref ───────────────────────────────────────────────────────────────────
    m_ref = re.search(r'برقم مرجعي\s*(\S+)', text)
    ref_number = m_ref.group(1) if m_ref else None

    # ── Description ──────────────────────────────────────────────────────────
    if 'EGP' in text and 'إلى' in text:       # IPN transfer
        m = re.search(r'إلى\s+(.+?)\s+برقم', text)
        desc = f"تحويل إلى {m.group(1).strip()}" if m else "IPN Transfer"
    elif 'شراء' in text:                        # Purchase
        m = re.search(r'جم من\s+(.+?)\s+برقم', text)
        desc = f"شراء من {m.group(1).strip()}" if m else "Purchase"
    else:                                        # Instant transfer
        desc = "تحويل لحظي"

    return {"amount": amount, "description": desc, "ref_number": ref_number, "tx_date": tx_date}


# ── Webhook token helper ───────────────────────────────────────────────────────

def _get_or_create_token(brand_id: int, db) -> str:
    row = db.query(models.AppSettings).filter(
        models.AppSettings.key == "sms_webhook_token",
        models.AppSettings.brand_id == brand_id,
    ).first()
    if row and row.value:
        return row.value
    token = secrets.token_urlsafe(24)
    if row:
        row.value = token
    else:
        db.add(models.AppSettings(key="sms_webhook_token", brand_id=brand_id, value=token))
    db.commit()
    return token


# ── Intake endpoint (no JWT) ───────────────────────────────────────────────────

class SmsIntakeBody(BaseModel):
    body: str


@router.post("/sms/intake")
def sms_intake(payload: SmsIntakeBody, token: str = Query(...)):
    with get_db() as db:
        # Find brand by token
        setting = db.query(models.AppSettings).filter(
            models.AppSettings.key == "sms_webhook_token",
            models.AppSettings.value == token,
        ).first()
        if not setting:
            raise HTTPException(403, "Invalid token")
        brand_id = setting.brand_id

        # Parse
        parsed = parse_cib_sms(payload.body)
        if not parsed:
            return {"ok": False, "reason": "unrecognised", "received": repr(payload.body[:200])}

        # Dedup by ref_number
        if parsed["ref_number"]:
            existing = db.query(models.SmsSuggestion).filter(
                models.SmsSuggestion.brand_id == brand_id,
                models.SmsSuggestion.ref_number == parsed["ref_number"],
            ).first()
            if existing:
                return {"ok": True, "duplicate": True, "id": existing.id}

        suggestion = models.SmsSuggestion(
            brand_id    = brand_id,
            raw_text    = payload.body,
            amount      = parsed["amount"],
            description = parsed["description"],
            ref_number  = parsed["ref_number"],
            tx_date     = parsed["tx_date"],
            status      = "pending",
            created_at  = datetime.utcnow(),
        )
        db.add(suggestion)
        db.commit()
        db.refresh(suggestion)
        return {"ok": True, "id": suggestion.id, "parsed": {
            "amount": parsed["amount"],
            "description": parsed["description"],
            "ref_number": parsed["ref_number"],
            "tx_date": parsed["tx_date"].isoformat(),
        }}


# ── Token management ──────────────────────────────────────────────────────────

@router.get("/sms/token")
def get_sms_token(
    brand_id: int = Depends(get_brand_id),
    _admin: models.User = Depends(require_admin),
):
    with get_db() as db:
        token = _get_or_create_token(brand_id, db)
    return {
        "token": token,
        "intake_url": f"https://ecom-production-a643.up.railway.app/sms/intake?token={token}",
    }


@router.post("/sms/token/regenerate")
def regenerate_sms_token(
    brand_id: int = Depends(get_brand_id),
    _admin: models.User = Depends(require_admin),
):
    with get_db() as db:
        row = db.query(models.AppSettings).filter(
            models.AppSettings.key == "sms_webhook_token",
            models.AppSettings.brand_id == brand_id,
        ).first()
        token = secrets.token_urlsafe(24)
        if row:
            row.value = token
        else:
            db.add(models.AppSettings(key="sms_webhook_token", brand_id=brand_id, value=token))
        db.commit()
    return {
        "token": token,
        "intake_url": f"https://ecom-production-a643.up.railway.app/sms/intake?token={token}",
    }


# ── Suggestions CRUD ──────────────────────────────────────────────────────────

@router.get("/cashflow/sms-suggestions")
def list_suggestions(
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(get_current_user),
):
    with get_db() as db:
        rows = (
            db.query(models.SmsSuggestion)
            .filter(
                models.SmsSuggestion.brand_id == brand_id,
                models.SmsSuggestion.status == "pending",
            )
            .order_by(models.SmsSuggestion.tx_date.desc())
            .all()
        )
        return [
            {
                "id":          r.id,
                "amount":      r.amount,
                "description": r.description,
                "ref_number":  r.ref_number,
                "tx_date":     r.tx_date.isoformat() if r.tx_date else None,
                "created_at":  r.created_at.isoformat(),
            }
            for r in rows
        ]


class AcceptBody(BaseModel):
    month: str          # month name, e.g. "Mar 2026"
    category: str
    notes: str = ""
    amount: float | None = None   # allow override


@router.post("/cashflow/sms-suggestions/{suggestion_id}/accept")
def accept_suggestion(
    suggestion_id: int,
    body: AcceptBody,
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(require_writable),
):
    with get_db() as db:
        suggestion = db.query(models.SmsSuggestion).filter(
            models.SmsSuggestion.id == suggestion_id,
            models.SmsSuggestion.brand_id == brand_id,
        ).first()
        if not suggestion:
            raise HTTPException(404, "Suggestion not found")
        if suggestion.status != "pending":
            raise HTTPException(400, "Suggestion already handled")

        # Look up month by name
        month = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.name == body.month,
            models.CashflowMonth.brand_id == brand_id,
        ).first()
        if not month:
            raise HTTPException(404, "Month not found")

        amount = body.amount if body.amount and body.amount > 0 else suggestion.amount
        today  = datetime.utcnow()
        entry  = models.CashflowEntry(
            month_id   = month.id,
            date       = today.strftime("%-d/%-m"),
            type       = "out",
            amount     = amount,
            category   = body.category,
            notes      = body.notes or suggestion.description or "",
            created_at = today,
        )
        db.add(entry)
        suggestion.status = "accepted"
        db.commit()
        db.refresh(entry)
        return {"ok": True, "entry_id": entry.id}


@router.post("/cashflow/sms-suggestions/{suggestion_id}/dismiss")
def dismiss_suggestion(
    suggestion_id: int,
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(get_current_user),
):
    with get_db() as db:
        suggestion = db.query(models.SmsSuggestion).filter(
            models.SmsSuggestion.id == suggestion_id,
            models.SmsSuggestion.brand_id == brand_id,
        ).first()
        if not suggestion:
            raise HTTPException(404, "Suggestion not found")
        suggestion.status = "dismissed"
        db.commit()
    return {"ok": True}
