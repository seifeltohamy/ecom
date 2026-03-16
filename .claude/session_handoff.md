# Session Handoff
<!-- AGENT INSTRUCTIONS: Prepend new entries — most recent at the top. Keep last 3 sessions only; move older entries to archive/. -->

---

## Last Session — 2026-03-17 (SMS fixes + Bosta payout email feature)

### What Was Done

**Bank SMS fixes:**
- Route conflict fixed: `sms.router` registered before `cashflow.router` in `main.py`
- Debit card SMS format added (`عند <merchant> في DD/MM/YY HH:MM`)
- Dismiss confirmation: `window.confirm()` before dismissing suggestions
- Debug `received` field on parse failure

**Bosta Payout Email → Cashflow Suggestions:**
- Migration 0018: `type VARCHAR(8) DEFAULT 'out'` + `category VARCHAR(128)` on `sms_suggestions`
- `app/bosta_payout.py` (new): Gmail IMAP, last-2-days search, RFC 2047 subject decode, Arabic-Indic amount + invoice parse, dedup by ref_number, `type='in'` + `category='Bosta'`
- `app/routers/sms.py`: list returns `type`+`category`; accept uses `suggestion.type` + `body.category or suggestion.category`; new `POST /sms/check-bosta-payouts`
- `main.py`: `CronTrigger(hour='*/4')` for `run_bosta_payout_check`
- `Cashflow.jsx`: "📧 Check Bosta Payouts" button; Bosta accept form (read-only category label, green amount, Month+Notes only); SMS form unchanged

**Pending:**
- Bosta payout RFC 2047 fix deployed (9af9d63) — needs re-test after Railway deploy
- iOS Shortcut sends empty body without "Ask Before Running" ON — unresolved

---

## Session — 2026-03-16 (Bank SMS feature + Stock alert config)

**Stock Alert configurable per brand:**
- `app/stock_alert.py`: reads `alert_enabled`, `alert_time_1`, `alert_time_2`, `alert_low_stock_days` from `app_settings`; single hourly CronTrigger checks UTC time
- `Settings.jsx`: TimePicker + threshold days UI

**Bank SMS → Cashflow Suggestions:**
- Migration 0017: `sms_suggestions` table
- `app/routers/sms.py` (new): `parse_cib_sms()` (3 CIB types); `POST /sms/intake?token=xxx`; token management; suggestions CRUD
- `Settings.jsx`: "Bank SMS Integration" card with webhook URL + iOS Shortcut setup
- `Cashflow.jsx`: suggestions banner, accept/dismiss inline

---

## Session — 2026-03-16 (BI Assistant + Settings fix)

**BI Assistant rebuilt:**
- Upgraded to Gemini 2.5 Flash; chat-style accumulating messages; markdown rendering (`react-markdown`); thinking animation; optimistic UI; New Chat button; full-height layout; EGP currency in system prompt; live stock inventory (top 30) in snapshot; `/bi` in `PERMISSIONED_PAGES`; mobile responsive

**Settings page:** brand name badge in orange pill; `.catch()` + `.finally()` on fetch

---

## Session — 2026-03-12 (Admin users + Analytics fixes + Read Only users)

**Admin Portal — Admin Users table:** `GET /admin/admins`, `PUT /admin/admins/{id}/brands`, `DELETE /admin/admins/{id}`; inline brand access editing

**Analytics fixes:** proportional distribution (÷ total); 0.5% min floor; right column 150px + nowrap; Stock Value duplicate title removed

**Settings viewer access:** `GET /settings` relaxed to `get_current_user`; `/settings` added to `PERMISSIONED_PAGES`

**Read Only user permission:** migration 0015 `users.read_only`; `require_writable` dep; toggle UI in Users.jsx

**Analytics + Stock Value enhancements:** Net stat card; Money In by Source chart; Bosta P&L Summary card; All-Months Trend table; Sold/Sell-Through%/Days Left columns; GMROI + Slow Mover Capital cards; `GET /dashboard/trend` + `GET /dashboard/bosta-summary` endpoints

---

## Project History (milestone log)

| Date | Milestone |
|------|-----------|
| Early 2026 | Initial single `index.html` SPA |
| 2026-03-01 | Vite + React Router v6 migration; mobile layout |
| 2026-03-03 | Railway deployment; Products Sold + Stock Value + Settings pages |
| 2026-03-09 | Multi-tenant brands (migration 0006); BrandPicker; EcomHQ rebrand |
| 2026-03-10 | Bosta fulfillment API; Stock Value Consumer/Purchase price |
| 2026-03-11 | P&L formula editor; DB indexes (0011); Admin Portal; main.py → app/routers/ split |
| 2026-03-11 | Bosta daily automation (Playwright + Gmail IMAP) fully working |
| 2026-03-12 | Read Only users; Analytics overhaul; Admin users table; BI Assistant |
| 2026-03-16 | Stock alert config; Bank SMS suggestions; BI rebuild; Settings fix |
| 2026-03-17 | Bosta payout email → suggestions; SMS debit card format; dismiss confirm |

---

## How to Resume

1. Read `CLAUDE.md` + `.claude/` files
2. Check `.claude/checklist.md` for pending work
3. Check `.claude/API_contract.md` before touching endpoints
4. Check `.claude/DB_schema.md` before touching models/migrations
5. Dev: `./start.sh` (macOS) — backend :8080, frontend :5173

Admin credentials (dev): `admin@zen.com` / `Zen@2026`
