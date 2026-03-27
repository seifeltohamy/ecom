"""
emails.py — Gmail inbox triage via Gemini.

GET  /emails/summary  → return cached triage result from app_settings
POST /emails/scan     → fetch last 7 days via IMAP, call Gemini, cache + return result

Credentials: reuses bosta_email + bosta_email_password per brand (already stored in app_settings).
"""

import email as email_lib
import email.header
import email.utils
import imaplib
import json
import logging
import os
import re
from datetime import date, timedelta, datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_db, get_current_user, get_brand_id
from app import models

router = APIRouter()
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)

_CACHE_KEY = "email_summary_cache"

# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode_header(raw: str) -> str:
    """Decode RFC 2047 encoded email header to plain string."""
    parts = email.header.decode_header(raw or "")
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            try:
                decoded.append(part.decode(charset or "utf-8", errors="replace"))
            except Exception:
                decoded.append(part.decode("utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def _extract_text(msg) -> str:
    """Extract up to 400 chars of plaintext from an email message."""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/plain":
                try:
                    body = part.get_payload(decode=True).decode(
                        part.get_content_charset() or "utf-8", errors="replace"
                    )
                    break
                except Exception:
                    continue
            elif ct == "text/html" and not body:
                try:
                    html = part.get_payload(decode=True).decode(
                        part.get_content_charset() or "utf-8", errors="replace"
                    )
                    # Strip HTML tags
                    body = re.sub(r"<[^>]+>", " ", html)
                    body = re.sub(r"\s+", " ", body).strip()
                except Exception:
                    continue
    else:
        try:
            raw = msg.get_payload(decode=True)
            if raw:
                body = raw.decode(msg.get_content_charset() or "utf-8", errors="replace")
                if msg.get_content_type() == "text/html":
                    body = re.sub(r"<[^>]+>", " ", body)
                    body = re.sub(r"\s+", " ", body).strip()
        except Exception:
            pass
    return body[:400].strip()


def _get_credentials(brand_id: int) -> tuple[str, str]:
    """Read bosta_email + bosta_email_password from app_settings. Returns (email, app_password)."""
    with get_db() as db:
        rows = db.query(models.AppSettings).filter(
            models.AppSettings.brand_id == brand_id,
            models.AppSettings.key.in_(["bosta_email", "bosta_email_password"]),
        ).all()
    m = {r.key: r.value for r in rows}
    return m.get("bosta_email", ""), m.get("bosta_email_password", "")


def _upsert_cache(brand_id: int, payload: dict) -> None:
    """Store the summary cache in app_settings."""
    value = json.dumps(payload, ensure_ascii=False)
    with get_db() as db:
        row = db.query(models.AppSettings).filter(
            models.AppSettings.key == _CACHE_KEY,
            models.AppSettings.brand_id == brand_id,
        ).first()
        if row:
            row.value = value
        else:
            db.add(models.AppSettings(key=_CACHE_KEY, brand_id=brand_id, value=value))
        db.commit()


def _fetch_emails(gmail_user: str, gmail_app_password: str) -> list[dict]:
    """Connect via IMAP, fetch last 7 days, return list of {from, subject, date, snippet}."""
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(gmail_user, gmail_app_password)
    except imaplib.IMAP4.error as e:
        raise HTTPException(400, f"Gmail login failed — check App Password and that IMAP is enabled: {e}")

    mail.select('"[Gmail]/All Mail"')
    since = (date.today() - timedelta(days=7)).strftime("%d-%b-%Y")
    _, msgs = mail.search(None, f'SINCE {since}')
    ids = msgs[0].split()

    # Take the 100 most recent
    ids = ids[-100:]
    ids = list(reversed(ids))

    emails = []
    for msg_id in ids:
        try:
            _, data = mail.fetch(msg_id, "(RFC822)")
            msg = email_lib.message_from_bytes(data[0][1])

            from_raw = msg.get("From", "")
            subject  = _decode_header(msg.get("Subject", "(no subject)"))
            date_str = msg.get("Date", "")
            snippet  = _extract_text(msg)

            emails.append({
                "from":    from_raw,
                "subject": subject,
                "date":    date_str,
                "snippet": snippet,
            })
        except Exception:
            continue

    mail.logout()
    logger.info(f"Fetched {len(emails)} emails for brand IMAP scan")
    return emails


def _call_gemini(emails: list[dict]) -> dict:
    """Send email list to Gemini, return {summary, action_items}."""
    if not GEMINI_API_KEY:
        raise HTTPException(400, "GEMINI_API_KEY not configured on server")

    system_prompt = (
        "You are an email triage assistant for an Egyptian e-commerce brand owner. "
        "Analyze the inbox emails provided and return a JSON object with exactly two keys:\n"
        "1. 'summary': a markdown string with an executive summary of inbox activity. "
        "Call out customer support emails, domain/account issues, payment issues, and anything urgent. "
        "Group by theme. Be concise.\n"
        "2. 'action_items': an array of objects, each with:\n"
        "   - 'priority': 'high', 'medium', or 'low'\n"
        "   - 'subject': the email subject\n"
        "   - 'from': the sender\n"
        "   - 'reason': one sentence explaining why action is needed\n"
        "High priority: customer complaints, account/domain verification requests, payment/billing issues, legal notices.\n"
        "Medium priority: supplier or partner emails needing a reply, pending orders or refund requests.\n"
        "Low priority: routine notifications that require a minor action.\n"
        "Ignore and DO NOT include: newsletters, promotional emails, automated shipping notifications, "
        "marketing emails — unless they contain something requiring action.\n"
        "Return ONLY valid JSON with no markdown code fences, no extra text."
    )
    user_content = (
        f"Here are the last 7 days of inbox emails ({len(emails)} emails):\n"
        + json.dumps(emails, ensure_ascii=False)
    )

    try:
        resp = httpx.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": user_content}]}],
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Gemini API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(502, f"Gemini request failed: {e}")

    candidates = data.get("candidates", [])
    if not candidates:
        raise HTTPException(502, "Gemini returned no candidates")

    raw_text = candidates[0]["content"]["parts"][0]["text"].strip()

    # Strip markdown code fences if Gemini ignores our instruction
    if raw_text.startswith("```"):
        raw_text = re.sub(r"^```[a-z]*\n?", "", raw_text)
        raw_text = re.sub(r"\n?```$", "", raw_text.rstrip())

    try:
        parsed = json.loads(raw_text)
        return {
            "summary":      parsed.get("summary", ""),
            "action_items": parsed.get("action_items", []),
        }
    except json.JSONDecodeError:
        # Gemini didn't return valid JSON — store raw text as summary
        logger.warning("Gemini did not return valid JSON — storing raw text as summary")
        return {"summary": raw_text, "action_items": []}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/emails/summary")
def get_email_summary(
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(get_current_user),
):
    gmail_user, gmail_pass = _get_credentials(brand_id)
    configured = bool(gmail_user and gmail_pass)

    with get_db() as db:
        row = db.query(models.AppSettings).filter(
            models.AppSettings.key == _CACHE_KEY,
            models.AppSettings.brand_id == brand_id,
        ).first()

    if not row:
        return {
            "configured":   configured,
            "fetched_at":   None,
            "email_count":  0,
            "summary":      None,
            "action_items": [],
        }

    cached = json.loads(row.value)
    cached["configured"] = configured
    return cached


@router.post("/emails/scan")
def scan_email(
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(get_current_user),
):
    gmail_user, gmail_pass = _get_credentials(brand_id)
    if not gmail_user or not gmail_pass:
        raise HTTPException(
            400,
            "Gmail credentials not configured. Add your Gmail address and App Password in Settings → Bosta Integration.",
        )

    emails = _fetch_emails(gmail_user, gmail_pass)
    result = _call_gemini(emails)

    # Sort action_items: high → medium → low
    priority_order = {"high": 0, "medium": 1, "low": 2}
    result["action_items"].sort(
        key=lambda x: priority_order.get(x.get("priority", "low"), 2)
    )

    payload = {
        "summary":      result["summary"],
        "action_items": result["action_items"],
        "email_count":  len(emails),
        "fetched_at":   datetime.utcnow().isoformat(),
    }
    _upsert_cache(brand_id, payload)
    payload["configured"] = True
    return payload
