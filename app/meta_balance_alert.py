"""
meta_balance_alert.py — Meta Ads wallet balance alert job.

Runs every 10 minutes via APScheduler.
Sends an email alert when the Meta Ads balance drops to or below the
configured threshold (default 5,000 EGP). Emails continue every 10 minutes
until the balance recovers above the threshold.
"""

import logging
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.stock_alert import _get_all_brands, _get_brand_settings, _send_email
from app.meta_client import compute_meta_balance

logger = logging.getLogger("meta_balance_alert")


def _build_balance_alert_html(brand_name: str, balance: float, threshold: float, currency: str) -> str:
    now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
    <div style="background:#dc2626;padding:20px 28px;">
      <h1 style="margin:0;color:#fff;font-size:1.2rem;">⚠️ Meta Ads Low Balance</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:.9rem;">{brand_name} — wallet needs a top-up</p>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;font-size:.95rem;margin-bottom:20px;">
        <tr style="background:#fef2f2;">
          <td style="padding:12px 16px;border-bottom:1px solid #fecaca;font-weight:600;color:#991b1b;">Current Balance</td>
          <td style="padding:12px 16px;border-bottom:1px solid #fecaca;font-weight:700;color:#dc2626;font-size:1.2rem;">{currency} {balance:,.2f}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#6b7280;">Alert Threshold</td>
          <td style="padding:12px 16px;color:#374151;">{currency} {threshold:,.2f}</td>
        </tr>
      </table>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:14px 16px;font-size:.875rem;color:#991b1b;">
        <strong>Action required:</strong> Top up your Meta Ads wallet to resume normal ad delivery.
        Low balance may cause your campaigns to pause automatically.
      </div>
    </div>
    <div style="padding:12px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:.78rem;color:#9ca3af;">
      Sent by EcomHQ Meta Ads Alert · {now} · Alerts repeat every 10 minutes while balance stays below threshold.
    </div>
  </div>
</body>
</html>"""


def run_meta_balance_alert_job(force: bool = False, brand_id_filter: int | None = None):
    """Check Meta Ads balance for all brands (or one brand) and send alert if below threshold."""
    logger.info("Meta balance alert job running (force=%s, brand_filter=%s)", force, brand_id_filter)

    brands = _get_all_brands()
    if brand_id_filter is not None:
        brands = [b for b in brands if b["brand_id"] == brand_id_filter]
    for brand in brands:
        brand_id   = brand["brand_id"]
        brand_name = brand["brand_name"]
        try:
            settings   = _get_brand_settings(brand_id)
            token      = settings.get("meta_access_token", "")
            account_id = settings.get("meta_ad_account_id", "")
            email      = settings.get("bosta_email", "")
            password   = settings.get("bosta_email_password", "")

            if not token or not account_id:
                logger.debug("Brand %s (%s): Meta not connected, skipping", brand_id, brand_name)
                continue
            if not email or not password:
                logger.debug("Brand %s (%s): no email credentials, skipping", brand_id, brand_name)
                continue

            try:
                threshold = float(settings.get("meta_balance_threshold", "5000"))
            except (ValueError, TypeError):
                threshold = 5000.0

            balance_data = compute_meta_balance(brand_id)
            balance      = balance_data["balance"]
            currency     = balance_data.get("currency", "EGP")

            if balance <= threshold or force:
                subject = f"⚠️ Meta Ads Low Balance — {currency} {balance:,.2f} remaining ({brand_name})"
                html    = _build_balance_alert_html(brand_name, balance, threshold, currency)
                _send_email(email, password, subject, html)
                logger.info("Brand %s (%s): balance alert sent — %.2f %s (threshold %.2f)",
                            brand_id, brand_name, balance, currency, threshold)
            else:
                logger.info("Brand %s (%s): balance %.2f %s OK (threshold %.2f)",
                            brand_id, brand_name, balance, currency, threshold)

        except Exception as exc:
            logger.error("Brand %s (%s): error — %s", brand_id, brand_name, exc, exc_info=True)

    logger.info("Meta balance alert job finished")
