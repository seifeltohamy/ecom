# Plan: Daily Bosta Export Automation (macOS)

## Context

Every day, a Bosta orders report needs to be exported (full sheet, then sorted and filtered to current month), sorted by "Delivered at", and uploaded to the EcomHQ portal. This runs automatically via macOS launchd. Each brand configures their own Bosta credentials in the Settings page. The automation is a single script that loops all brands, fetches their credentials from the EcomHQ API, and runs the full pipeline per brand.

---

## Architecture

```
launchd (daily 7 AM)
  └─ automation/bosta_daily.py
       ├── httpx → GET /admin/brand-settings  (read each brand's Bosta credentials)
       └── For each brand:
             ├── Playwright: login to Bosta → download full Excel (no date filter on Bosta side)
             ├── openpyxl: sort ALL rows ascending by "Delivered at"
             ├── openpyxl: filter to current month only (after sort)
             └── httpx: POST /auth/select-brand → POST /upload
```

---

## Part 1 — Settings Page: Add Bosta Login Credentials Per Brand

Two new fields added to the Settings page alongside the existing API key field.

### Backend (`main.py`)
`GET /settings` and `PUT /settings` already handle arbitrary `app_settings` keys per brand. No backend changes needed — the frontend just sends two more keys: `bosta_email` and `bosta_password`.

### Frontend (`frontend/src/pages/Settings.jsx`)

Add two new fields below the API key input:
- **Bosta Login Email** → key `bosta_email`
- **Bosta Password** → key `bosta_password` (password input type, masked)

These are loaded on mount (same as `bosta_api_key`) and saved on submit.

**File:** `frontend/src/pages/Settings.jsx`

---

## Part 2 — New Admin Endpoint: GET /admin/brand-settings

The automation script needs to fetch Bosta credentials for all brands without manually selecting each brand. Add an admin-only endpoint:

```
GET /admin/brand-settings
Auth: Bearer + require_admin (no brand_id needed)
Response: [
  { brand_id: 1, brand_name: "Zen", bosta_email: "...", bosta_password: "...", bosta_api_key: "..." },
  ...
]
```

Implementation in `main.py`: query all brands, for each fetch relevant `app_settings` keys. Returns only brands that have `bosta_email` set (skip unconfigured brands).

**File:** `main.py`

---

## Part 3 — Automation Script

### Files to Create

| File | Purpose |
|------|---------|
| `automation/bosta_daily.py` | Main script |
| `automation/.env.automation` | Admin credentials + EcomHQ URL (gitignored) |
| `automation/.env.automation.example` | Template committed to git |
| `automation/setup_mac.sh` | Installs playwright + loads launchd plist |
| `automation/com.ecomhq.bosta_daily.plist` | launchd job definition |

### Config (`automation/.env.automation`)

```ini
ECOMHQ_URL=https://ecom-production-a643.up.railway.app
ECOMHQ_ADMIN_EMAIL=admin@zen.com
ECOMHQ_ADMIN_PASSWORD=Zen@2026
LOG_FILE=/tmp/bosta_daily.log
```

No per-brand Bosta credentials here — those are read from the EcomHQ API.

---

### Step 1 — Fetch brand configs from EcomHQ

```python
def get_brand_configs(url, admin_email, admin_password):
    r = httpx.post(f"{url}/auth/login",
        data={"username": admin_email, "password": admin_password})
    r.raise_for_status()
    token = r.json()["access_token"]
    r = httpx.get(f"{url}/admin/brand-settings",
        headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json(), token  # list of {brand_id, brand_name, bosta_email, bosta_password}
```

---

### Step 2 — Download full Excel from Bosta (no date filter in Bosta UI)

```python
def download_bosta_excel(email, password, download_dir):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://app.bosta.co/login")
        page.fill('input[name="email"]', email)
        page.fill('input[name="password"]', password)
        page.click('button[type="submit"]')
        page.wait_for_url("**/dashboard**", timeout=15000)
        page.goto("https://app.bosta.co/deliveries")
        page.wait_for_load_state("networkidle")
        # Click Export (no date filter — download everything)
        with page.expect_download() as dl_info:
            page.click('button:has-text("Export"), button:has-text("Download")')
        download = dl_info.value
        path = os.path.join(download_dir, download.suggested_filename or "bosta.xlsx")
        download.save_as(path)
        browser.close()
        return path
```

> **Note:** Playwright selectors are approximate — adjust after first run based on actual Bosta UI.

---

### Step 3 — Sort then Filter by current month

```python
from datetime import date, datetime

def sort_then_filter(path):
    wb = openpyxl.load_workbook(path)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]

    col_idx = next((i for i, h in enumerate(header) if h == "Delivered at"), None)
    if col_idx is None:
        raise ValueError("'Delivered at' column not found")

    today = date.today()
    first = today.replace(day=1)

    def parse_date(val):
        if not val:
            return None
        for fmt in ("%m-%d-%Y, %H:%M:%S", "%m-%d-%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.strptime(str(val).strip(), fmt).date()
            except ValueError:
                continue
        return None

    data = rows[1:]

    # Step 1: Sort ALL rows ascending by "Delivered at"
    data.sort(key=lambda r: parse_date(r[col_idx]) or date.min)

    # Step 2: Filter to current month only (after sort)
    filtered = [r for r in data
                if (d := parse_date(r[col_idx])) and first <= d <= today]

    # Rewrite sheet
    ws.delete_rows(2, ws.max_row)
    for row in filtered:
        ws.append(list(row))

    out = path.replace(".xlsx", "_sorted_filtered.xlsx")
    wb.save(out)
    return out, first.isoformat(), today.isoformat()
```

---

### Step 4 — Upload to EcomHQ

```python
def upload(url, admin_token, brand_id, file_path, date_from, date_to):
    r = httpx.post(f"{url}/auth/select-brand",
        json={"brand_id": brand_id},
        headers={"Authorization": f"Bearer {admin_token}"})
    r.raise_for_status()
    brand_token = r.json()["access_token"]

    with open(file_path, "rb") as f:
        r = httpx.post(f"{url}/upload",
            headers={"Authorization": f"Bearer {brand_token}"},
            data={"date_from": date_from, "date_to": date_to},
            files={"file": (os.path.basename(file_path), f,
                   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=60)
    r.raise_for_status()
    return r.json()
```

---

### Step 5 — Main loop

```python
def main():
    cfg = dotenv_values(os.path.join(os.path.dirname(__file__), ".env.automation"))
    logging.basicConfig(filename=cfg.get("LOG_FILE", "/tmp/bosta_daily.log"),
                        level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    log = logging.getLogger()
    brands, admin_token = get_brand_configs(
        cfg["ECOMHQ_URL"], cfg["ECOMHQ_ADMIN_EMAIL"], cfg["ECOMHQ_ADMIN_PASSWORD"])
    for brand in brands:
        log.info(f"Processing brand: {brand['brand_name']}")
        try:
            with tempfile.TemporaryDirectory() as tmp:
                path = download_bosta_excel(brand["bosta_email"], brand["bosta_password"], tmp)
                sorted_path, date_from, date_to = sort_then_filter(path)
                result = upload(cfg["ECOMHQ_URL"], admin_token,
                                brand["brand_id"], sorted_path, date_from, date_to)
                log.info(f"  → report_id={result.get('report_id')}, rows={result.get('order_count')}")
        except Exception as e:
            log.exception(f"  Brand {brand['brand_name']} failed: {e}")
```

---

## launchd Plist (`automation/com.ecomhq.bosta_daily.plist`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ecomhq.bosta_daily</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/seifeltohamy/Desktop/Zen/sku-app/.venv/bin/python</string>
    <string>/Users/seifeltohamy/Desktop/Zen/sku-app/automation/bosta_daily.py</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>  <integer>7</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/bosta_daily_stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/bosta_daily_stderr.log</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
```

---

## Setup Script (`automation/setup_mac.sh`)

```bash
#!/bin/bash
set -e
PROJ="/Users/seifeltohamy/Desktop/Zen/sku-app"

"$PROJ/.venv/bin/pip" install playwright python-dotenv
"$PROJ/.venv/bin/python" -m playwright install chromium

cp "$PROJ/automation/com.ecomhq.bosta_daily.plist" ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.ecomhq.bosta_daily.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.ecomhq.bosta_daily.plist

echo "Done. Job runs daily at 7:00 AM."
echo "Test now: launchctl start com.ecomhq.bosta_daily"
echo "Logs: /tmp/bosta_daily.log"
```

---

## Files to Change/Create

| File | Change |
|------|--------|
| `frontend/src/pages/Settings.jsx` | Add `bosta_email` + `bosta_password` fields |
| `main.py` | Add `GET /admin/brand-settings` endpoint |
| `automation/bosta_daily.py` | New script |
| `automation/.env.automation.example` | New template |
| `automation/setup_mac.sh` | New setup script |
| `automation/com.ecomhq.bosta_daily.plist` | New launchd plist |
| `.gitignore` | Add `automation/.env.automation` |

No DB migration needed — `app_settings` already supports arbitrary keys per brand.

---

## Verification

1. Go to Settings page for a brand → enter Bosta email + password → save
2. `GET /admin/brand-settings` as admin → confirm brand appears with credentials
3. Copy `.env.automation.example` → `.env.automation`, fill in admin creds
4. Run: `.venv/bin/python automation/bosta_daily.py`
5. Check `/tmp/bosta_daily.log` → sort → filter → upload OK
6. Check EcomHQ Bosta Orders → new report for this month appears
7. `launchctl list | grep ecomhq` → job registered

---

## Known Limitation

Playwright selectors for Bosta's Export button are approximate. After first run, if download fails, check the log and adjust selectors based on actual Bosta web app HTML.

---

## Implementation Notes (from live testing 2026-03-11)

### Corrections discovered during testing

| Original assumption | Reality |
|---------------------|---------|
| Login URL: `app.bosta.co/login` | `business.bosta.co/signin` |
| After login: redirects to `/orders` | Redirects to `/overview` |
| Export = direct browser download (`expect_download`) | Export sends file via email (`no-reply@bosta.co` → Gmail) |

### Actual flow implemented in `bosta_daily.py`
```
Playwright:
  1. goto https://business.bosta.co/signin
  2. fill email + password → click submit
  3. wait_for_url("**/overview**")
  4. goto https://business.bosta.co/orders
  5. click "text=Successful"
  6. click 'button:has-text("Export")'
  7. wait 3s (Bosta triggers email send)

IMAP (imaplib stdlib):
  8. poll Gmail inbox for email FROM "no-reply@bosta.co" SUBJECT "Export" UNSEEN
  9. extract download link via regex
  10. download file via httpx

openpyxl:
  11. sort all rows by "Delivered at" (col index 12, format: MM-DD-YYYY, HH:MM:SS)
  12. filter to current month
  13. upload to EcomHQ /upload

```

### New credential required
- `bosta_email_password` — Gmail App Password (NOT Gmail login password)
- Stored in `app_settings` per brand, shown in Settings page
- Generate at: Gmail → Security → 2-Step Verification → App Passwords

### Excel column confirmed
- "Delivered at" = column index 12 (0-based)
- Date format: `MM-DD-YYYY, HH:MM:SS` string (e.g. `01-13-2026, 17:33:50`)
- No nulls in delivered exports (Successful tab only contains delivered orders)

### Testing state (2026-03-11)
- `.env.automation` set to `http://localhost:8080` for local testing
- Login ✅ → overview ✅ → navigate to /orders ✅
- Click "تم بنجاح" tab ✅ (Bosta UI in Arabic — selector: `text=تم بنجاح`)
- Click "تحميل" export button ✅ (Arabic — selector: `button:has-text("تحميل")`)
- Export email arrives in Gmail ✅
- IMAP polling: fixed — removed unreliable `UNSEEN` filter, now timestamp-based (only picks emails newer than trigger time)
- End-to-end download link → sort → upload — pending next test run
- Switch `.env.automation` back to production URL before final deploy
