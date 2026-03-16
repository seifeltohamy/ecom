"""
Bosta cashout receipt email → cashflow suggestion.

Polls Gmail IMAP for emails from no-reply@bosta.co with subject "Cashout".
Parses the payout amount + invoice number and creates a SmsSuggestion
with type='in' and category='Bosta'.

Called:
  - By APScheduler every 4 hours (run_bosta_payout_check)
  - Manually via POST /sms/check-bosta-payouts
"""

import email as email_lib
import imaplib
import logging
import re
from datetime import datetime, timedelta

from app.deps import get_db
from app import models

logger = logging.getLogger("bosta_payout")

# Arabic-Indic → Western digit translation table
_AR_TO_EN = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def _strip_html(html: str) -> str:
    """Remove HTML tags, collapse whitespace."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _parse_arabic_amount(text: str) -> float | None:
    """Find the payout amount in the plain-text email body.

    Tries Arabic-Indic numerals first (e.g. ٢٤٩٩٣.٣٦ جنيه),
    then Western numerals (e.g. 24993.36).
    """
    # Arabic-Indic near جنيه
    m = re.search(r"([\u0660-\u0669٫,\.]+)\s*جنيه", text)
    if m:
        raw = m.group(1).translate(_AR_TO_EN).replace("٫", ".").replace(",", "")
        try:
            return float(raw)
        except ValueError:
            pass

    # Western digits near جنيه or EGP
    m = re.search(r"([\d,]+\.?\d*)\s*(?:جنيه|EGP)", text)
    if m:
        try:
            return float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    return None


def _parse_invoice(text: str) -> str | None:
    """Extract invoice number like SUNCOD15MAR26."""
    m = re.search(r"([A-Z]{3,}\d{2}[A-Z]{3}\d{2})", text)
    return m.group(1) if m else None


def _parse_tx_date(text: str) -> datetime:
    """Try to extract a date like '15 Mar, 2026' from the email body."""
    m = re.search(r"(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[,\s]+(\d{4})", text)
    if m:
        try:
            return datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(3)}", "%d %b %Y")
        except ValueError:
            pass
    return datetime.utcnow()


def check_bosta_payout_emails(brand_id: int, db) -> int:
    """Check Gmail for Bosta cashout emails and create suggestions.

    Returns the number of new suggestions created.
    """
    # Get credentials
    settings = {
        r.key: r.value
        for r in db.query(models.AppSettings).filter(
            models.AppSettings.brand_id == brand_id
        ).all()
    }
    gmail_user = settings.get("bosta_email", "")
    gmail_pass = settings.get("bosta_email_password", "")
    if not gmail_user or not gmail_pass:
        logger.info("Brand %s: no Gmail credentials configured, skipping", brand_id)
        return 0

    new_count = 0
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(gmail_user, gmail_pass)
        mail.select("inbox")

        # Search last 30 days from no-reply@bosta.co
        since = (datetime.utcnow() - timedelta(days=30)).strftime("%d-%b-%Y")
        _, msgs = mail.search(None, f'FROM "no-reply@bosta.co" SINCE {since}')
        ids = msgs[0].split()
        logger.info("Brand %s: %d email(s) from no-reply@bosta.co in last 30 days", brand_id, len(ids))

        for msg_id in ids:
            _, data = mail.fetch(msg_id, "(RFC822)")
            msg = email_lib.message_from_bytes(data[0][1])

            subject = msg.get("Subject", "")
            if "Cashout" not in subject and "cashout" not in subject:
                continue

            # Get plain text from HTML body
            body_text = ""
            if msg.is_multipart():
                for part in msg.walk():
                    ct = part.get_content_type()
                    if ct == "text/html":
                        payload = part.get_payload(decode=True)
                        if payload:
                            body_text = _strip_html(payload.decode("utf-8", errors="ignore"))
                            break
                    elif ct == "text/plain" and not body_text:
                        payload = part.get_payload(decode=True)
                        if payload:
                            body_text = payload.decode("utf-8", errors="ignore")
            else:
                payload = msg.get_payload(decode=True)
                if payload:
                    body_text = _strip_html(payload.decode("utf-8", errors="ignore"))

            if not body_text:
                continue

            amount = _parse_arabic_amount(body_text)
            if not amount:
                logger.warning("Brand %s: could not parse amount from Cashout email (subject: %s)", brand_id, subject)
                continue

            invoice = _parse_invoice(body_text)
            tx_date = _parse_tx_date(body_text)

            # Dedup by invoice number if we have one
            if invoice:
                existing = db.query(models.SmsSuggestion).filter(
                    models.SmsSuggestion.brand_id == brand_id,
                    models.SmsSuggestion.ref_number == invoice,
                ).first()
                if existing:
                    logger.debug("Brand %s: invoice %s already exists, skipping", brand_id, invoice)
                    continue

            suggestion = models.SmsSuggestion(
                brand_id    = brand_id,
                raw_text    = body_text[:500],
                amount      = amount,
                description = "Bosta Payout",
                ref_number  = invoice,
                tx_date     = tx_date,
                type        = "in",
                category    = "Bosta",
                status      = "pending",
                created_at  = datetime.utcnow(),
            )
            db.add(suggestion)
            db.commit()
            new_count += 1
            logger.info("Brand %s: created Bosta payout suggestion — %s EGP (invoice %s)", brand_id, amount, invoice)

        mail.logout()

    except Exception as exc:
        logger.error("Brand %s: bosta payout check failed — %s", brand_id, exc, exc_info=True)

    return new_count


def run_bosta_payout_check():
    """APScheduler entry point — runs every 4 hours for all brands."""
    logger.info("Bosta payout check starting…")
    with get_db() as db:
        brands = db.query(models.Brand).all()
        brand_ids = [b.id for b in brands]

    for brand_id in brand_ids:
        with get_db() as db:
            try:
                n = check_bosta_payout_emails(brand_id, db)
                if n:
                    logger.info("Brand %s: %d new payout suggestion(s)", brand_id, n)
            except Exception as exc:
                logger.error("Brand %s: error — %s", brand_id, exc, exc_info=True)

    logger.info("Bosta payout check done")
