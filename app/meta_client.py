"""
meta_client.py — Facebook Ads SDK wrapper.

All functions accept explicit access_token + ad_account_id so they work
both inside request handlers (brand-scoped) and background jobs.
"""

import os
import httpx

from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.user import User

META_APP_ID     = os.getenv("META_APP_ID", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")

# ── Token exchange ────────────────────────────────────────────────────────────

def exchange_token(short_lived_token: str) -> str:
    """Exchange a short-lived FB JS SDK token for a long-lived (60-day) token.
    Falls back to the original token if exchange fails (already long-lived)."""
    r = httpx.get(
        "https://graph.facebook.com/v21.0/oauth/access_token",
        params={
            "grant_type":        "fb_exchange_token",
            "client_id":         META_APP_ID,
            "client_secret":     META_APP_SECRET,
            "fb_exchange_token": short_lived_token,
        },
        timeout=15,
    )
    if r.status_code != 200:
        # Surface the actual Facebook error message
        try:
            fb_error = r.json().get("error", {}).get("message", r.text)
        except Exception:
            fb_error = r.text
        raise ValueError(f"Token exchange failed: {fb_error}")
    data = r.json()
    if "error" in data:
        raise ValueError(data["error"].get("message", "Token exchange failed"))
    return data["access_token"]


# ── User / account discovery ──────────────────────────────────────────────────

def get_user_name(access_token: str) -> str:
    FacebookAdsApi.init(META_APP_ID, META_APP_SECRET, access_token)
    user = User(fbid="me")
    user.api_get(fields=["name"])
    return user.get("name", "")


def get_ad_accounts(access_token: str) -> list:
    """Return list of {id, name, currency, status} for the authenticated user."""
    FacebookAdsApi.init(META_APP_ID, META_APP_SECRET, access_token)
    user = User(fbid="me")
    accounts = user.get_ad_accounts(
        fields=["name", "account_id", "account_status", "currency"]
    )
    return [
        {
            "id":       f"act_{a['account_id']}",
            "name":     a.get("name", ""),
            "currency": a.get("currency", ""),
            "status":   a.get("account_status", 1),
        }
        for a in accounts
    ]


# ── Insights ──────────────────────────────────────────────────────────────────

def _meta_error_message(r: httpx.Response) -> str:
    """Extract a clean Facebook error message from a response, never including the access token."""
    try:
        err = r.json().get("error", {})
        msg = err.get("message") or err.get("error_user_msg") or f"HTTP {r.status_code}"
        code = err.get("code")
        sub = err.get("error_subcode")
        if code in (190, 102) or sub in (463, 467):
            return "Meta access token expired. Please reconnect Meta Ads in Settings."
        return f"Meta API: {msg}"
    except Exception:
        return f"Meta API returned HTTP {r.status_code}"


def get_spend_summary(access_token: str, ad_account_id: str,
                      date_from: str, date_to: str) -> dict:
    """Return {spend, currency} for the given date range at account level."""
    import json
    r = httpx.get(
        f"https://graph.facebook.com/v21.0/{ad_account_id}/insights",
        params={
            "fields":     "spend,account_currency",
            "time_range": json.dumps({"since": date_from, "until": date_to}),
            "level":      "account",
            "access_token": access_token,
        },
        timeout=15,
    )
    if r.status_code != 200:
        raise ValueError(_meta_error_message(r))
    rows = r.json().get("data", [])
    row  = rows[0] if rows else {}
    return {
        "spend":    round(float(row.get("spend", 0) or 0), 2),
        "currency": row.get("account_currency", "EGP"),
    }


def _usd_to_egp_rate() -> float:
    """Fetch live USD→EGP rate. Uses exchangerate-api.com (supports EGP, no key required)."""
    try:
        r = httpx.get(
            "https://open.er-api.com/v6/latest/USD",
            timeout=8,
        )
        return float(r.json()["rates"]["EGP"])
    except Exception:
        return 50.0   # fallback if API is unreachable


def _month_name_to_range(month_name: str) -> tuple[str, str]:
    """Convert 'Apr 2026' or 'April 2026' to ('2026-04-01', '2026-04-30'), capped at today.
    Lenient: strips whitespace and tries title-cased variant ('april 2026' → 'April 2026')."""
    import calendar
    from datetime import datetime, date
    cleaned = (month_name or "").strip()
    candidates = [cleaned, cleaned.title()]
    dt = None
    for candidate in candidates:
        for fmt in ("%d %b %Y", "%d %B %Y"):
            try:
                dt = datetime.strptime(f"1 {candidate}", fmt)
                break
            except ValueError:
                continue
        if dt:
            break
    if not dt:
        raise ValueError(f"Cannot parse month name: {month_name!r}")
    first = dt.date()
    last_day = calendar.monthrange(first.year, first.month)[1]
    last = date(first.year, first.month, last_day)
    today = date.today()
    if last > today:
        last = today
    return first.strftime("%Y-%m-%d"), last.strftime("%Y-%m-%d")


def compute_meta_balance(brand_id: int, month_name: str | None = None) -> dict:
    """Compute remaining Meta Ads balance from cashflow data (not Meta API).

    Formula: carried_from_prev_month + Ads money-out (this month) - Meta spend (this month)

    If month_name is provided, scopes ads_deposited and meta_spend to that month.
    """
    from app.deps import get_db
    from app import models

    with get_db() as db:
        settings = {r.key: r.value for r in db.query(models.AppSettings).filter(
            models.AppSettings.brand_id == brand_id).all()}

        carried = float(settings.get("meta_carried_balance", "0") or "0")

        if month_name:
            target_month = db.query(models.CashflowMonth).filter(
                models.CashflowMonth.brand_id == brand_id,
                models.CashflowMonth.name == month_name,
            ).first()
        else:
            target_month = db.query(models.CashflowMonth).filter(
                models.CashflowMonth.brand_id == brand_id
            ).order_by(models.CashflowMonth.id.desc()).first()

        ads_deposited = 0.0
        if target_month:
            entries = db.query(models.CashflowEntry).filter(
                models.CashflowEntry.month_id == target_month.id,
                models.CashflowEntry.type == "out",
                models.CashflowEntry.category == "Ads",
            ).all()
            ads_deposited = sum(e.amount for e in entries)

    token      = settings.get("meta_access_token", "")
    account_id = settings.get("meta_ad_account_id", "")
    meta_spend = 0.0
    if token and account_id:
        if month_name:
            date_from, date_to = _month_name_to_range(month_name)
        else:
            from datetime import datetime, timezone
            today     = datetime.now(timezone.utc)
            date_from = today.replace(day=1).strftime("%Y-%m-%d")
            date_to   = today.strftime("%Y-%m-%d")
        try:
            meta_spend = get_spend_summary(token, account_id, date_from, date_to)["spend"]
        except Exception:
            pass

    return {"balance": round(carried + ads_deposited - meta_spend, 2), "currency": "EGP"}


def get_account_balance(access_token: str, ad_account_id: str) -> dict:
    """Return {balance, currency} in EGP.

    Meta stores balances internally in USD × the account's FX rate, so for
    EGP accounts: balance_egp = raw_api_value ÷ live_usd_egp_rate
    (confirmed by comparing Graph API vs Ads Manager UI).
    """
    FacebookAdsApi.init(META_APP_ID, META_APP_SECRET, access_token)
    account = AdAccount(ad_account_id)
    account.api_get(fields=["balance", "currency"])
    currency = account.get("currency", "EGP")
    raw = float(account.get("balance", 0) or 0)
    if currency == "EGP":
        rate    = _usd_to_egp_rate()
        balance = round(raw / rate, 2)
    else:
        # For non-EGP accounts the balance is in currency cents
        balance = round(raw / 100, 2)
    return {"balance": balance, "currency": currency}


def get_adset_insights(access_token: str, ad_account_id: str,
                       date_from: str, date_to: str) -> list:
    """Return per-adset rows: {adset_id, adset_name, spend, roas, purchases, cpr}."""
    import json
    r = httpx.get(
        f"https://graph.facebook.com/v21.0/{ad_account_id}/insights",
        params={
            "fields":     "adset_id,adset_name,spend,actions,cost_per_action_type,purchase_roas",
            "time_range": json.dumps({"since": date_from, "until": date_to}),
            "level":      "adset",
            "limit":      "500",
            "access_token": access_token,
        },
        timeout=30,
    )
    if r.status_code != 200:
        raise ValueError(_meta_error_message(r))
    insights = r.json().get("data", [])
    rows = []
    for row in insights:
        actions = {a["action_type"]: float(a["value"]) for a in (row.get("actions") or [])}
        cpa = {a["action_type"]: float(a["value"]) for a in (row.get("cost_per_action_type") or [])}
        roas_list = row.get("purchase_roas") or []
        roas = next((float(r["value"]) for r in roas_list if r.get("action_type") == "omni_purchase"), None)
        purchases = actions.get("purchase") or actions.get("omni_purchase") or 0
        cpr = cpa.get("purchase") or cpa.get("omni_purchase") or None
        rows.append({
            "adset_id":   row.get("adset_id", ""),
            "adset_name": row.get("adset_name", ""),
            "spend":      round(float(row.get("spend", 0) or 0), 2),
            "roas":       round(roas, 2) if roas else None,
            "purchases":  int(purchases),
            "cpr":        round(cpr, 2) if cpr else None,
        })
    return rows


def get_campaigns(access_token: str, ad_account_id: str,
                  date_from: str, date_to: str) -> list:
    """Return per-campaign rows: {campaign_name, results, cpr, spend, roas}."""
    import json
    r = httpx.get(
        f"https://graph.facebook.com/v21.0/{ad_account_id}/insights",
        params={
            "fields":     "campaign_name,spend,actions,cost_per_action_type,purchase_roas",
            "time_range": json.dumps({"since": date_from, "until": date_to}),
            "level":      "campaign",
            "access_token": access_token,
        },
        timeout=15,
    )
    if r.status_code != 200:
        raise ValueError(_meta_error_message(r))
    insights = r.json().get("data", [])
    rows = []
    for row in insights:
        actions = {
            a["action_type"]: float(a["value"])
            for a in (row.get("actions") or [])
        }
        cpa = {
            a["action_type"]: float(a["value"])
            for a in (row.get("cost_per_action_type") or [])
        }
        roas_list = row.get("purchase_roas") or []
        roas = next(
            (float(r["value"]) for r in roas_list if r.get("action_type") == "omni_purchase"),
            None,
        )
        purchases = actions.get("purchase") or actions.get("omni_purchase") or 0
        cpr       = cpa.get("purchase") or cpa.get("omni_purchase") or None
        rows.append({
            "campaign_name": row.get("campaign_name", ""),
            "results":       int(purchases),
            "cpr":           round(cpr, 2) if cpr else None,
            "spend":         round(float(row.get("spend", 0) or 0), 2),
            "roas":          round(roas, 2) if roas else None,
        })
    return rows
