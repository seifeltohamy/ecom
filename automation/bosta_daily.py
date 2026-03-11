#!/usr/bin/env python3
"""
bosta_daily.py — Daily Bosta export automation

For each brand configured in EcomHQ Settings (bosta_email + bosta_password):
  1. Login to Bosta via Playwright and download the full deliveries Excel
  2. Sort ALL rows by "Delivered at" (ascending)
  3. Filter to current month only
  4. Upload sorted+filtered Excel to EcomHQ portal

Config: automation/.env.automation (copy from .env.automation.example)
Logs:   /tmp/bosta_daily.log  (or LOG_FILE in config)

Run manually: .venv/bin/python automation/bosta_daily.py
"""

import os
import logging
import tempfile
from datetime import date, datetime

import httpx
import openpyxl
from dotenv import dotenv_values
from playwright.sync_api import sync_playwright

# ── Config ────────────────────────────────────────────────────────────────────

CFG_PATH = os.path.join(os.path.dirname(__file__), ".env.automation")
cfg = dotenv_values(CFG_PATH)

ECOMHQ_URL   = cfg.get("ECOMHQ_URL",            "https://ecom-production-a643.up.railway.app")
ADMIN_EMAIL   = cfg.get("ECOMHQ_ADMIN_EMAIL",   "")
ADMIN_PASS    = cfg.get("ECOMHQ_ADMIN_PASSWORD", "")
LOG_FILE      = cfg.get("LOG_FILE",              "/tmp/bosta_daily.log")

logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)

# ── Step 1: Fetch brand configs ───────────────────────────────────────────────

def get_brand_configs():
    """Login as admin, return list of brand configs + admin token."""
    r = httpx.post(f"{ECOMHQ_URL}/auth/login",
                   data={"username": ADMIN_EMAIL, "password": ADMIN_PASS},
                   timeout=15)
    r.raise_for_status()
    token = r.json()["access_token"]

    r = httpx.get(f"{ECOMHQ_URL}/admin/brand-settings",
                  headers={"Authorization": f"Bearer {token}"},
                  timeout=15)
    r.raise_for_status()
    return r.json(), token  # [{brand_id, brand_name, bosta_email, bosta_password}], token

# ── Step 2: Download full Excel from Bosta ────────────────────────────────────

def download_bosta_excel(email: str, password: str, download_dir: str) -> str:
    """Login to Bosta and download the full deliveries Excel. Returns local file path."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(accept_downloads=True)
        page = ctx.new_page()

        log.info("  Navigating to Bosta login…")
        page.goto("https://app.bosta.co/login")
        page.fill('input[name="email"], input[type="email"]', email)
        page.fill('input[name="password"], input[type="password"]', password)
        page.click('button[type="submit"]')
        page.wait_for_url("**/dashboard**", timeout=20000)

        log.info("  Navigating to deliveries page…")
        page.goto("https://app.bosta.co/deliveries")
        page.wait_for_load_state("networkidle")

        # Click Export button — no date filter (download everything)
        # NOTE: If this selector fails, inspect Bosta's export button and update below
        log.info("  Clicking Export…")
        with page.expect_download(timeout=60000) as dl_info:
            page.click('button:has-text("Export"), button:has-text("Download"), [data-testid="export-btn"]')

        download = dl_info.value
        filename = download.suggested_filename or "bosta_export.xlsx"
        path = os.path.join(download_dir, filename)
        download.save_as(path)
        log.info(f"  Downloaded → {path}")

        ctx.close()
        browser.close()
        return path

# ── Step 3: Sort then Filter ──────────────────────────────────────────────────

def parse_delivered_at(val) -> date | None:
    """Parse a 'Delivered at' cell value to a date object."""
    if not val:
        return None
    s = str(val).strip()
    for fmt in ("%m-%d-%Y, %H:%M:%S", "%m-%d-%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def sort_then_filter(path: str) -> tuple[str, str, str]:
    """
    1. Sort ALL rows ascending by 'Delivered at'
    2. Filter to current month only
    Returns (output_path, date_from_iso, date_to_iso)
    """
    wb = openpyxl.load_workbook(path)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]

    # Find "Delivered at" column — exact match (project quirk)
    col_idx = next((i for i, h in enumerate(header) if h == "Delivered at"), None)
    if col_idx is None:
        raise ValueError(f"'Delivered at' column not found. Headers: {header}")

    today = date.today()
    first = today.replace(day=1)

    data = list(rows[1:])

    # Step 1: Sort ALL rows by "Delivered at" ascending
    data.sort(key=lambda r: parse_delivered_at(r[col_idx]) or date.min)

    # Step 2: Filter to current month
    filtered = [
        r for r in data
        if (d := parse_delivered_at(r[col_idx])) and first <= d <= today
    ]

    log.info(f"  Rows before filter: {len(data)} → after filter: {len(filtered)}")

    # Rewrite sheet with header + filtered+sorted rows
    ws.delete_rows(2, ws.max_row)
    for row in filtered:
        ws.append(list(row))

    out = path.replace(".xlsx", "_sorted_filtered.xlsx")
    wb.save(out)
    return out, first.isoformat(), today.isoformat()

# ── Step 4: Upload to EcomHQ ──────────────────────────────────────────────────

def upload_to_ecomhq(admin_token: str, brand_id: int,
                     file_path: str, date_from: str, date_to: str) -> dict:
    """Select brand JWT, then upload the Excel file."""
    r = httpx.post(f"{ECOMHQ_URL}/auth/select-brand",
                   json={"brand_id": brand_id},
                   headers={"Authorization": f"Bearer {admin_token}"},
                   timeout=15)
    r.raise_for_status()
    brand_token = r.json()["access_token"]

    with open(file_path, "rb") as f:
        r = httpx.post(
            f"{ECOMHQ_URL}/upload",
            headers={"Authorization": f"Bearer {brand_token}"},
            data={"date_from": date_from, "date_to": date_to},
            files={"file": (
                os.path.basename(file_path), f,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )},
            timeout=120,
        )
    r.raise_for_status()
    return r.json()

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    log.info("=== bosta_daily.py started ===")

    if not ADMIN_EMAIL or not ADMIN_PASS:
        log.error("ECOMHQ_ADMIN_EMAIL / ECOMHQ_ADMIN_PASSWORD not set in .env.automation")
        return

    try:
        brands, admin_token = get_brand_configs()
    except Exception as e:
        log.exception(f"Failed to fetch brand configs: {e}")
        return

    if not brands:
        log.info("No brands with Bosta credentials configured — nothing to do.")
        return

    log.info(f"Processing {len(brands)} brand(s)…")

    for brand in brands:
        name     = brand["brand_name"]
        brand_id = brand["brand_id"]
        email    = brand["bosta_email"]
        password = brand["bosta_password"]

        log.info(f"--- Brand: {name} (id={brand_id}) ---")
        try:
            with tempfile.TemporaryDirectory() as tmp:
                path = download_bosta_excel(email, password, tmp)
                sorted_path, date_from, date_to = sort_then_filter(path)
                result = upload_to_ecomhq(admin_token, brand_id, sorted_path, date_from, date_to)
                log.info(
                    f"  Uploaded OK — report_id={result.get('report_id')}, "
                    f"orders={result.get('order_count')}, "
                    f"revenue={result.get('grand_revenue')}"
                )
        except Exception as e:
            log.exception(f"  Brand '{name}' failed: {e}")

    log.info("=== bosta_daily.py done ===")


if __name__ == "__main__":
    main()
