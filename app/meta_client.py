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

def get_spend_summary(access_token: str, ad_account_id: str,
                      date_from: str, date_to: str) -> dict:
    """Return {spend, currency} for the given date range at account level."""
    FacebookAdsApi.init(META_APP_ID, META_APP_SECRET, access_token)
    account  = AdAccount(ad_account_id)
    insights = account.get_insights(
        fields=["spend", "account_currency"],
        params={
            "time_range": {"since": date_from, "until": date_to},
            "level":      "account",
        },
    )
    row = list(insights)[0] if insights else {}
    return {
        "spend":    round(float(row.get("spend", 0) or 0), 2),
        "currency": row.get("account_currency", "EGP"),
    }


def _usd_to_egp_rate() -> float:
    """Fetch live USD→EGP rate from frankfurter.app (free, no key required)."""
    try:
        r = httpx.get(
            "https://api.frankfurter.app/latest",
            params={"from": "USD", "to": "EGP"},
            timeout=8,
        )
        return float(r.json()["rates"]["EGP"])
    except Exception:
        return 68.0   # fallback if API is unreachable


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


def get_campaigns(access_token: str, ad_account_id: str,
                  date_from: str, date_to: str) -> list:
    """Return per-campaign rows: {campaign_name, results, cpr, spend, roas}."""
    FacebookAdsApi.init(META_APP_ID, META_APP_SECRET, access_token)
    account  = AdAccount(ad_account_id)
    insights = account.get_insights(
        fields=[
            "campaign_name",
            "spend",
            "actions",
            "cost_per_action_type",
            "purchase_roas",
        ],
        params={
            "time_range": {"since": date_from, "until": date_to},
            "level":      "campaign",
        },
    )
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
