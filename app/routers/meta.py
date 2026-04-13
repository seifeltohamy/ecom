"""
meta.py — Facebook/Meta Ads API endpoints.

OAuth flow:
  1. Frontend: FB.login() popup → short-lived user access token
  2. POST /meta/auth  → exchange for long-lived token, return ad accounts list
  3. POST /meta/select-account → brand picks an ad account, saved to AppSettings
"""

import os
from datetime import datetime, date as _date

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.deps import get_db, get_current_user, get_brand_id, require_admin
from app import models
from app import meta_client

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_meta_settings(brand_id: int) -> dict:
    with get_db() as db:
        rows = db.query(models.AppSettings).filter(
            models.AppSettings.brand_id == brand_id,
            models.AppSettings.key.in_(["meta_access_token", "meta_ad_account_id", "meta_connected_name"]),
        ).all()
        return {r.key: r.value for r in rows}


def _upsert_setting(brand_id: int, key: str, value: str):
    with get_db() as db:
        row = db.query(models.AppSettings).filter(
            models.AppSettings.key == key,
            models.AppSettings.brand_id == brand_id,
        ).first()
        if row:
            row.value = value
        else:
            db.add(models.AppSettings(key=key, brand_id=brand_id, value=value))
        db.commit()


def _delete_setting(brand_id: int, key: str):
    with get_db() as db:
        row = db.query(models.AppSettings).filter(
            models.AppSettings.key == key,
            models.AppSettings.brand_id == brand_id,
        ).first()
        if row:
            db.delete(row)
            db.commit()


def _current_month_range() -> tuple[str, str]:
    today = _date.today()
    return today.replace(day=1).isoformat(), today.isoformat()


# ── Schemas ────────────────────────────────────────────────────────────────────

class MetaAuthBody(BaseModel):
    access_token: str   # short-lived token from FB JS SDK

class SelectAccountBody(BaseModel):
    ad_account_id: str  # e.g. "act_1234567890"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/meta/config")
def meta_config(_user: models.User = Depends(get_current_user)):
    """Return the Facebook App ID for FB JS SDK initialisation."""
    app_id = os.getenv("META_APP_ID", "")
    if not app_id:
        raise HTTPException(status_code=503, detail="META_APP_ID not configured on server")
    return {"app_id": app_id}


@router.get("/meta/status")
def meta_status(
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(get_current_user),
):
    s = _get_meta_settings(brand_id)
    return {
        "connected":       bool(s.get("meta_access_token")),
        "connected_name":  s.get("meta_connected_name", ""),
        "ad_account_id":   s.get("meta_ad_account_id", ""),
    }


@router.post("/meta/auth")
def meta_auth(
    body:     MetaAuthBody,
    brand_id: int = Depends(get_brand_id),
    _admin:   models.User = Depends(require_admin),
):
    """Exchange short-lived token → long-lived, save, return ad accounts list."""
    if not os.getenv("META_APP_ID") or not os.getenv("META_APP_SECRET"):
        raise HTTPException(status_code=503, detail="META_APP_ID / META_APP_SECRET not configured on server")

    try:
        long_token = meta_client.exchange_token(body.access_token)
        name       = meta_client.get_user_name(long_token)
        accounts   = meta_client.get_ad_accounts(long_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Meta API error: {str(e)}")

    _upsert_setting(brand_id, "meta_access_token",   long_token)
    _upsert_setting(brand_id, "meta_connected_name", name)

    return {"ok": True, "connected_name": name, "ad_accounts": accounts}


@router.post("/meta/auth/manual")
def meta_auth_manual(
    body:     MetaAuthBody,
    brand_id: int = Depends(get_brand_id),
    _admin:   models.User = Depends(require_admin),
):
    """Save a pre-existing long-lived token directly (skips OAuth exchange)."""
    try:
        name     = meta_client.get_user_name(body.access_token)
        accounts = meta_client.get_ad_accounts(body.access_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid token: {str(e)}")

    _upsert_setting(brand_id, "meta_access_token",   body.access_token)
    _upsert_setting(brand_id, "meta_connected_name", name)

    return {"ok": True, "connected_name": name, "ad_accounts": accounts}


@router.post("/meta/select-account")
def meta_select_account(
    body:     SelectAccountBody,
    brand_id: int = Depends(get_brand_id),
    _admin:   models.User = Depends(require_admin),
):
    """Save the chosen ad account ID for this brand."""
    _upsert_setting(brand_id, "meta_ad_account_id", body.ad_account_id)
    return {"ok": True}


@router.delete("/meta/disconnect")
def meta_disconnect(
    brand_id: int = Depends(get_brand_id),
    _admin:   models.User = Depends(require_admin),
):
    """Remove all Meta credentials for this brand."""
    for key in ("meta_access_token", "meta_ad_account_id", "meta_connected_name"):
        _delete_setting(brand_id, key)
    return {"ok": True}


@router.get("/meta/summary")
def meta_summary(
    date_from: str | None = None,
    date_to:   str | None = None,
    month:     str | None = None,
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(get_current_user),
):
    """Return {spend, balance, currency} for the given date range (defaults: current month).
    If `month` is provided (e.g. 'Apr 2026'), derives date range and scopes balance to that month."""
    s = _get_meta_settings(brand_id)
    token      = s.get("meta_access_token", "")
    account_id = s.get("meta_ad_account_id", "")
    if not token or not account_id:
        return {"connected": False, "spend": 0, "balance": 0, "currency": "EGP"}

    try:
        if month:
            date_from, date_to = meta_client._month_name_to_range(month)
        elif not date_from or not date_to:
            date_from, date_to = _current_month_range()
        spend_data   = meta_client.get_spend_summary(token, account_id, date_from, date_to)
        balance_data = meta_client.compute_meta_balance(brand_id, month_name=month)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Meta API error: {str(e)}")

    return {
        "connected": True,
        "spend":     spend_data["spend"],
        "balance":   balance_data["balance"],
        "currency":  spend_data.get("currency") or balance_data.get("currency", "EGP"),
        "date_from": date_from,
        "date_to":   date_to,
    }


@router.get("/meta/campaigns")
def meta_campaigns(
    date_from: str | None = None,
    date_to:   str | None = None,
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(get_current_user),
):
    """Return per-campaign rows for the given date range."""
    s = _get_meta_settings(brand_id)
    token      = s.get("meta_access_token", "")
    account_id = s.get("meta_ad_account_id", "")
    if not token or not account_id:
        return {"connected": False, "rows": []}

    if not date_from or not date_to:
        date_from, date_to = _current_month_range()

    try:
        rows = meta_client.get_campaigns(token, account_id, date_from, date_to)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Meta API error: {str(e)}")

    return {"connected": True, "rows": rows, "date_from": date_from, "date_to": date_to}
