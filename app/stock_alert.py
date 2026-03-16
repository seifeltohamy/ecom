"""
Stock low-inventory email alert job.
Runs via APScheduler at 09:00 and 18:00 UTC every day.
Sends an HTML email to each brand's bosta_email when items are low/out of stock.
"""

import json
import logging
import os
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.deps import get_db
from app import models

logger = logging.getLogger("stock_alert")

LOW_STOCK_DAYS = int(os.getenv("LOW_STOCK_DAYS", "30"))


# ── Data fetching ──────────────────────────────────────────────────────────────

def _get_all_brands():
    """Return list of {brand_id, brand_name} for every brand."""
    with get_db() as db:
        brands = db.query(models.Brand).all()
        return [{"brand_id": b.id, "brand_name": b.name} for b in brands]


def _get_brand_settings(brand_id: int) -> dict:
    """Return app_settings dict for a brand."""
    with get_db() as db:
        rows = db.query(models.AppSettings).filter(
            models.AppSettings.brand_id == brand_id
        ).all()
        return {r.key: r.value for r in rows}


def _fetch_stock_rows(brand_id: int, settings: dict) -> list:
    """
    Fetch live inventory from Bosta API + purchase prices + report sell data.
    Returns list of row dicts (same shape as /stock-value endpoint).
    Returns [] on any error.
    """
    api_key = settings.get("bosta_api_key", "")
    if not api_key:
        return []

    try:
        products, page, limit = [], 0, 100
        while True:
            resp = httpx.get(
                "http://app.bosta.co/api/v2/products/fulfillment/list-products",
                headers={"Authorization": api_key},
                params={"page": page, "limit": limit},
                timeout=20,
                follow_redirects=True,
            )
            if resp.status_code != 200:
                logger.warning("Bosta API %s for brand %s", resp.status_code, brand_id)
                return []
            batch = resp.json().get("data", {}).get("data", [])
            products.extend(batch)
            if len(batch) < limit:
                break
            page += 1
    except Exception as exc:
        logger.warning("Bosta API error for brand %s: %s", brand_id, exc)
        return []

    with get_db() as db:
        pp_rows = db.query(models.StockPurchasePrice).filter(
            models.StockPurchasePrice.brand_id == brand_id
        ).all()
        purchase_map = {r.sku: r.purchase_price for r in pp_rows}

        latest_report = (
            db.query(models.BostaReport)
            .filter(models.BostaReport.brand_id == brand_id)
            .order_by(models.BostaReport.uploaded_at.desc())
            .first()
        )
        qty_map, report_days = {}, 0
        if latest_report:
            report_rows = json.loads(latest_report.rows_json or "[]")
            qty_map = {r["sku"]: r.get("total_quantity", 0) for r in report_rows}
            if latest_report.date_from and latest_report.date_to:
                from datetime import date as _date
                d0 = _date.fromisoformat(latest_report.date_from)
                d1 = _date.fromisoformat(latest_report.date_to)
                report_days = max(1, (d1 - d0).days + 1)

    rows = []
    for p in products:
        sku     = p.get("product_code") or str(p.get("id", ""))
        name    = p.get("name") or "Unknown"
        on_hand = p.get("qty_available") or 0
        sold    = qty_map.get(sku, 0)

        if sold > 0 and report_days > 0:
            daily          = sold / report_days
            days_remaining = round(on_hand / daily) if daily > 0 else None
            avg_daily      = round(daily, 2)
        else:
            days_remaining = None
            avg_daily      = 0.0

        rows.append({
            "sku":           sku,
            "name":          name,
            "on_hand":       on_hand,
            "avg_daily":     avg_daily,
            "days_remaining": days_remaining,
        })

    return rows


# ── Email building ─────────────────────────────────────────────────────────────

def _row_color(row: dict) -> str:
    if row["on_hand"] == 0:
        return "#ffd5d5"   # red — out of stock
    dr = row["days_remaining"]
    if dr is not None and dr < 7:
        return "#ffe5c0"   # orange — < 7 days
    return "#fffbd0"       # yellow — low stock (< threshold)


def _build_html(brand_name: str, rows: list) -> str:
    now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    rows_html = ""
    for r in rows:
        color     = _row_color(r)
        status    = "Out of stock" if r["on_hand"] == 0 else (
                    f"{r['days_remaining']} days" if r["days_remaining"] is not None else "No sales data"
                )
        daily_str = f"{r['avg_daily']:.1f} units/day" if r["avg_daily"] > 0 else "—"
        rows_html += f"""
        <tr style="background:{color};">
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">{r['name']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;">{r['sku']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">{r['on_hand']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">{status}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">{daily_str}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:700px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
    <div style="background:#f97316;padding:20px 28px;">
      <h1 style="margin:0;color:#fff;font-size:1.2rem;">⚠️ EcomHQ Low Stock Alert</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:.9rem;">{brand_name} — {len(rows)} item(s) need attention</p>
    </div>
    <div style="padding:24px 28px;">
      <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Product</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">SKU</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e5e7eb;">In Stock</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e5e7eb;">Days Left</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e5e7eb;">Daily Sales</th>
          </tr>
        </thead>
        <tbody>{rows_html}
        </tbody>
      </table>
      <div style="margin-top:20px;padding:12px 16px;background:#fef3c7;border-radius:6px;font-size:.82rem;color:#92400e;">
        <strong>Color legend:</strong>
        <span style="margin-left:8px;">🔴 Out of stock</span>
        <span style="margin-left:12px;">🟠 Less than 7 days</span>
        <span style="margin-left:12px;">🟡 Less than {LOW_STOCK_DAYS} days</span>
      </div>
    </div>
    <div style="padding:12px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:.78rem;color:#9ca3af;">
      Sent by EcomHQ Stock Alert · {now}
    </div>
  </div>
</body>
</html>"""


# ── Email sending ──────────────────────────────────────────────────────────────

def _send_email(to_addr: str, gmail_password: str, subject: str, html: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = to_addr
    msg["To"]      = to_addr
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(to_addr, gmail_password)
        smtp.sendmail(to_addr, to_addr, msg.as_string())


# ── Main job ───────────────────────────────────────────────────────────────────

def run_stock_alert_job():
    """Called by APScheduler twice a day."""
    logger.info("Stock alert job started")

    brands = _get_all_brands()
    for brand in brands:
        brand_id   = brand["brand_id"]
        brand_name = brand["brand_name"]
        try:
            settings = _get_brand_settings(brand_id)
            email    = settings.get("bosta_email", "")
            password = settings.get("bosta_email_password", "")

            if not email or not password:
                logger.info("Brand %s (%s): no email/password configured, skipping", brand_id, brand_name)
                continue

            all_rows  = _fetch_stock_rows(brand_id, settings)
            if not all_rows:
                logger.info("Brand %s (%s): no stock data, skipping", brand_id, brand_name)
                continue

            # Filter: out of stock OR days_remaining below threshold
            low = [
                r for r in all_rows
                if r["on_hand"] == 0
                or (r["days_remaining"] is not None and r["days_remaining"] < LOW_STOCK_DAYS)
            ]

            if not low:
                logger.info("Brand %s (%s): all stock healthy, no email sent", brand_id, brand_name)
                continue

            # Sort: out-of-stock first, then by days_remaining asc (None last)
            low.sort(key=lambda r: (
                r["on_hand"] > 0,
                r["days_remaining"] if r["days_remaining"] is not None else 9999,
            ))

            subject = f"⚠️ EcomHQ Low Stock Alert — {brand_name} — {len(low)} item(s) need attention"
            html    = _build_html(brand_name, low)
            _send_email(email, password, subject, html)
            logger.info("Brand %s (%s): sent alert for %d items", brand_id, brand_name, len(low))

        except Exception as exc:
            logger.error("Brand %s (%s): error — %s", brand_id, brand_name, exc, exc_info=True)

    logger.info("Stock alert job finished")
