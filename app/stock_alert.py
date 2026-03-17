"""
Stock low-inventory email alert job.
Runs via APScheduler every hour on the hour.
Each brand configures its own alert times and threshold via Settings.
"""

import json
import logging
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.deps import get_db
from app import models

logger = logging.getLogger("stock_alert")


# ── Data fetching ──────────────────────────────────────────────────────────────

def _get_all_brands():
    with get_db() as db:
        brands = db.query(models.Brand).all()
        return [{"brand_id": b.id, "brand_name": b.name} for b in brands]


def _get_brand_settings(brand_id: int) -> dict:
    with get_db() as db:
        rows = db.query(models.AppSettings).filter(
            models.AppSettings.brand_id == brand_id
        ).all()
        return {r.key: r.value for r in rows}


def _fetch_stock_rows(brand_id: int, settings: dict) -> list:
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
            "sku":            sku,
            "name":           name,
            "on_hand":        on_hand,
            "avg_daily":      avg_daily,
            "days_remaining": days_remaining,
        })

    return rows


# ── Email building ─────────────────────────────────────────────────────────────

def _row_color(row: dict, low_stock_days: int) -> str:
    if row["on_hand"] == 0:
        return "#ffd5d5"
    dr = row["days_remaining"]
    if dr is not None and dr < 7:
        return "#ffe5c0"
    if dr is not None and dr < low_stock_days:
        return "#fffbd0"
    return "#ffffff"


def _build_html(brand_name: str, rows: list, low_stock_days: int, daily_report: bool = False) -> str:
    now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    rows_html = ""
    for r in rows:
        color     = _row_color(r, low_stock_days)
        status    = ("Out of stock" if r["on_hand"] == 0 else
                     (f"{r['days_remaining']} days" if r["days_remaining"] is not None else "No sales data"))
        daily_str = f"{r['avg_daily']:.1f} units/day" if r["avg_daily"] > 0 else "—"
        rows_html += f"""
        <tr style="background:{color};">
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">{r['name']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;">{r['sku']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">{r['on_hand']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">{status}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">{daily_str}</td>
        </tr>"""

    if daily_report:
        header_bg    = "#2563eb"
        header_title = "📦 EcomHQ Daily Inventory Report"
        header_sub   = f"{brand_name} — {len(rows)} product(s)"
    else:
        header_bg    = "#f97316"
        header_title = "⚠️ EcomHQ Low Stock Alert"
        header_sub   = f"{brand_name} — {len(rows)} item(s) need attention"

    return f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:700px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
    <div style="background:{header_bg};padding:20px 28px;">
      <h1 style="margin:0;color:#fff;font-size:1.2rem;">{header_title}</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:.9rem;">{header_sub}</p>
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
      <div style="margin-top:20px;padding:12px 16px;background:#f0f9ff;border-radius:6px;font-size:.82rem;color:#075985;">
        <strong>Color legend:</strong>
        <span style="margin-left:8px;">🔴 Out of stock</span>
        <span style="margin-left:12px;">🟠 &lt; 7 days</span>
        <span style="margin-left:12px;">🟡 &lt; {low_stock_days} days</span>
        <span style="margin-left:12px;">⚪ Healthy</span>
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
    """Called by APScheduler every hour on the hour. Each brand's configured times gate sending."""
    now_hm = datetime.now(tz=timezone.utc).strftime("%H:%M")
    logger.info("Stock alert job running at %s UTC", now_hm)

    brands = _get_all_brands()
    for brand in brands:
        brand_id   = brand["brand_id"]
        brand_name = brand["brand_name"]
        try:
            settings = _get_brand_settings(brand_id)

            # Master toggle
            if settings.get("alert_enabled", "true") != "true":
                logger.info("Brand %s (%s): alerts disabled, skipping", brand_id, brand_name)
                continue

            # Time gate — only send if current UTC HH:MM matches a configured time
            time_1 = settings.get("alert_time_1", "09:00")
            time_2 = settings.get("alert_time_2", "18:00")
            matched = (time_1 and now_hm == time_1) or (time_2 and now_hm == time_2)
            if not matched:
                logger.debug("Brand %s (%s): time %s not in [%s, %s], skipping", brand_id, brand_name, now_hm, time_1, time_2)
                continue

            # Credentials
            email    = settings.get("bosta_email", "")
            password = settings.get("bosta_email_password", "")
            if not email or not password:
                logger.info("Brand %s (%s): no email/password configured, skipping", brand_id, brand_name)
                continue

            # Threshold
            try:
                low_stock_days = int(settings.get("alert_low_stock_days", "30"))
            except (ValueError, TypeError):
                low_stock_days = 30

            all_rows = _fetch_stock_rows(brand_id, settings)
            if not all_rows:
                logger.info("Brand %s (%s): no stock data, skipping", brand_id, brand_name)
                continue

            # Sort all rows: out-of-stock first, then by days_remaining asc, then healthy
            all_rows.sort(key=lambda r: (
                r["on_hand"] > 0,
                r["days_remaining"] if r["days_remaining"] is not None else 9999,
            ))

            is_morning = (time_1 and now_hm == time_1)

            if is_morning:
                # Morning: always send full inventory report
                subject = f"📦 EcomHQ Daily Inventory — {brand_name} — {len(all_rows)} product(s)"
                html    = _build_html(brand_name, all_rows, low_stock_days, daily_report=True)
                _send_email(email, password, subject, html)
                logger.info("Brand %s (%s): sent daily inventory report (%d products)", brand_id, brand_name, len(all_rows))
            else:
                # Evening: send only low-stock alert, skip if all healthy
                low = [
                    r for r in all_rows
                    if r["on_hand"] == 0
                    or (r["days_remaining"] is not None and r["days_remaining"] < low_stock_days)
                ]
                if not low:
                    logger.info("Brand %s (%s): all stock healthy, no evening alert sent", brand_id, brand_name)
                    continue
                subject = f"⚠️ EcomHQ Low Stock Alert — {brand_name} — {len(low)} item(s) need attention"
                html    = _build_html(brand_name, low, low_stock_days, daily_report=False)
                _send_email(email, password, subject, html)
                logger.info("Brand %s (%s): sent low-stock alert for %d items", brand_id, brand_name, len(low))

        except Exception as exc:
            logger.error("Brand %s (%s): error — %s", brand_id, brand_name, exc, exc_info=True)

    logger.info("Stock alert job finished")
