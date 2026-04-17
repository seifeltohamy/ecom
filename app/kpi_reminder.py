"""
kpi_reminder.py — Hourly KPI checklist email reminder.

Runs every hour via APScheduler. For each brand's KPI categories,
checks if the current hour matches the category's schedule.
If so, sends a reminder email to users with notification_email set
listing their incomplete checklist items.
"""

import logging
from datetime import datetime, timezone

from app.deps import get_db
from app import models
from app.stock_alert import _send_email

logger = logging.getLogger("kpi_reminder")


def _schedule_matches(schedule: str | None, hour: int) -> bool:
    """Check if a schedule string matches the current hour.
    Formats: '*/3' (every 3 hours), '13' (at 1pm), None (no reminders).
    """
    if not schedule:
        return False
    schedule = schedule.strip()
    if schedule.startswith("*/"):
        try:
            interval = int(schedule[2:])
            return interval > 0 and hour % interval == 0
        except ValueError:
            return False
    try:
        return int(schedule) == hour
    except ValueError:
        return False


def _build_reminder_html(brand_name: str, category_name: str, pending_items: list[str]) -> str:
    now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    items_html = "".join(
        f'<li style="padding:6px 0;border-bottom:1px solid #e5e7eb;color:#374151;">{item}</li>'
        for item in pending_items
    )
    return f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
    <div style="background:#f97316;padding:20px 28px;">
      <h1 style="margin:0;color:#fff;font-size:1.2rem;">📋 {category_name} Checklist Reminder</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:.9rem;">{brand_name} — {len(pending_items)} item{'s' if len(pending_items) != 1 else ''} pending</p>
    </div>
    <div style="padding:28px;">
      <p style="font-size:.95rem;color:#6b7280;margin:0 0 16px;">The following items haven't been checked off yet today:</p>
      <ul style="list-style:none;padding:0;margin:0 0 20px;">{items_html}</ul>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:14px 16px;font-size:.875rem;color:#9a3412;">
        Log in to EcomHQ to complete your daily checklist.
      </div>
    </div>
    <div style="padding:12px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:.78rem;color:#9ca3af;">
      Sent by EcomHQ KPI Reminder · {now}
    </div>
  </div>
</body>
</html>"""


def run_kpi_reminder_job():
    """Check all brands' KPI categories and send reminders where schedule matches."""
    now = datetime.now(tz=timezone.utc)
    current_hour = now.hour
    today = now.strftime("%Y-%m-%d")

    logger.info("KPI reminder check — hour %d", current_hour)

    with get_db() as db:
        brands = db.query(models.Brand).all()
        brand_list = [(b.id, b.name) for b in brands]

    for brand_id, brand_name in brand_list:
        with get_db() as db:
            categories = db.query(models.KpiCategory).filter(
                models.KpiCategory.brand_id == brand_id
            ).all()

            for cat in categories:
                if not _schedule_matches(cat.schedule, current_hour):
                    continue

                items = db.query(models.KpiItem).filter(
                    models.KpiItem.category_id == cat.id
                ).all()
                if not items:
                    continue

                # Get all users on this brand with notification_email set
                users = db.query(models.User).filter(
                    models.User.notification_email.isnot(None),
                    models.User.notification_email != "",
                ).all()
                # Filter to users on this brand (viewers) or admins
                brand_users = [u for u in users if u.brand_id == brand_id or u.role == models.UserRole.admin]

                for user in brand_users:
                    # Find which items this user hasn't checked today
                    checked_ids = {
                        c.item_id for c in db.query(models.KpiCheck).filter(
                            models.KpiCheck.user_id == user.id,
                            models.KpiCheck.date == today,
                            models.KpiCheck.brand_id == brand_id,
                        ).all()
                    }
                    pending = [i for i in items if i.id not in checked_ids]
                    if not pending:
                        continue

                    subject = f"📋 {cat.name} — {len(pending)} pending item{'s' if len(pending) != 1 else ''} ({brand_name})"
                    html = _build_reminder_html(brand_name, cat.name, [i.title for i in pending])
                    try:
                        _send_email(user.notification_email, "", subject, html)
                        logger.info("Sent %s reminder to %s — %d pending", cat.name, user.notification_email, len(pending))
                    except Exception as exc:
                        logger.error("Failed to send KPI reminder to %s: %s", user.notification_email, exc)

    logger.info("KPI reminder check done")
