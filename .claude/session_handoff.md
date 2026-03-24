# Session Handoff
<!-- AGENT INSTRUCTIONS: Prepend new entries — most recent at the top. Keep last 3 sessions only; move older entries to archive/. -->

---

## Session — 2026-03-24 (Sidebar collapse + Dashboard cleanup + Automation fix)

### What Was Done

**Duplicate Dashboard heading removed:**
- `frontend/src/pages/Home.jsx`: removed hardcoded `<h1>Dashboard</h1>` + subtitle paragraph — Layout already renders these from `pageMeta`

**Collapsible sidebar (desktop):**
- `frontend/src/App.jsx`: added `sidebarOpen` state (default `true`); toggle button `◀/▶` in page header (hidden on mobile); sidebar gets `.collapsed` class
- `frontend/src/index.css`: `.zen-sidebar.collapsed { width: 0; padding: 0; overflow: hidden; }` with `transition: width/padding .25s ease`
- Mobile unaffected — still uses hamburger topbar

**Automation export session fix — "Export session expired or not found":**
- Root cause: `--workers 2` means SSE runs on worker A (stores file_id in memory), upload hits worker B (empty dict → 404)
- Fix in `app/routers/bosta.py`: replaced in-memory `pending_exports` dict with disk-based JSON files at `/tmp/ecomhq_export_<uuid>.json` — all workers share the same filesystem
- Added helpers: `_save_export`, `_load_export`, `_delete_export`

**Meta balance + opening balance (continued from prior session):**
- `compute_meta_balance(brand_id)` in `app/meta_client.py`: balance = carried + Ads cashflow out this month − Meta API spend
- `meta_carried_balance` in `app_settings`: set via Settings "Meta Opening Balance" field; auto-saved when creating a new cashflow month
- Meta balance alert (`app/meta_balance_alert.py`): uses `compute_meta_balance`; guard changed from `if not email or not password` → `if not email` (Resend doesn't need Gmail password)

### Pending
- None

---

## Session — 2026-03-23 (Production scaling + Email alerts + CIB SMS keywords)

### What Was Done

**CIB SMS keywords expanded:**
- `app/routers/sms.py`: added `"المنتهي بـ ********4707"` (account ending 4707) and two card 2297 formats: `"# **2297"` + `"**2297 #"`

**Production scaling (Railway Hobby plan upgraded):**
- `start_prod.sh`: added `--workers 2` to uvicorn
- `main.py`: APScheduler now uses file lock (`/tmp/ecomhq_scheduler.lock`) via `fcntl.flock` — only one worker starts the scheduler; others skip silently with log message
- `run_stock_alert_job` + `run_meta_balance_alert_job`: accept `brand_id_filter` param — trigger endpoints now scope to current brand only

**Settings page — Send Test Alert buttons:**
- `frontend/src/pages/Settings.jsx`: "Send Test Alert" button in Stock Alert card; "Test" button in Meta Ads balance threshold row
- Both call synchronous endpoints that return real result details (sent/skipped/error with reasons)
- `app/routers/settings.py`: `trigger-stock-alert` + `trigger-meta-balance-alert` now run synchronously, return per-brand results; scoped to current `brand_id`
- `app/stock_alert.py`: `run_stock_alert_job` returns `list[dict]` with per-brand status

**Email sending — switched from SMTP to Resend HTTPS API:**
- Railway blocks all outbound SMTP (ports 587 + 465 both time out)
- `app/stock_alert.py`: `_send_email` now POSTs to `api.resend.com/emails` using `RESEND_API_KEY` env var
- Sender: `alerts@seifeltohamy.com` (domain verified on Resend via Namecheap DNS records)
- `RESEND_API_KEY` must be set in Railway Variables

**EGP exchange rate fix:**
- `app/meta_client.py`: replaced `frankfurter.app` (returned 404 for EGP) with `open.er-api.com` — working correctly

**Pending:**
- Resend domain `seifeltohamy.com` DNS still propagating (status: Pending as of 2:32 AM) — verify in Resend after propagation completes
- Add `RESEND_API_KEY` to Railway Variables then test "Send Test Alert"

---

## Session — 2026-03-22 (Bosta payout fixes + Dialog system + Master Wallet)

### What Was Done

**Bosta payout configurable lookback:**
- `app/routers/settings.py`: added `bosta_payout_days` to `SettingsUpdate`, `GET /settings`, `PUT /settings`
- `app/bosta_payout.py`: reads `settings.get('bosta_payout_days')` (default 2); returns `payout_days` in response; searches `[Gmail]/All Mail` instead of `inbox` (Bosta emails land in Promotions); dismissed suggestions now reset to `pending` on re-check (dedup only skips pending/accepted)
- `frontend/src/pages/Settings.jsx`: numeric input "Payout email lookback" in Bosta card

**Styled Dialog system (replaces all native alert/confirm):**
- `frontend/src/components/Dialog.jsx`: new branded modal (dark overlay, `var(--surface)` card, Btn buttons)
- `frontend/src/utils/useDialog.js`: `useDialog()` hook — `info(title, body)` + `confirm(title, body)` as promises
- Replaced all `window.alert()` / `window.confirm()` / `alert()` / `confirm()` across: Cashflow, Todo, Products, Settings, Users, AdminPortal

**Master Wallet (migration 0022):**
- `alembic/versions/0022_wallet_entries.py`: new `wallet_entries` table
- `app/models.py`: `WalletEntry` model (`brand_id`, `month_name`, `month_net`, `balance_after`, `created_at`)
- `app/routers/cashflow.py`: `POST /cashflow/months` snapshots previous month's net into `wallet_entries`; new `GET /cashflow/wallet` endpoint (before `/{month}` to avoid route shadowing)
- `frontend/src/pages/Cashflow.jsx`: 4th summary card "Master Wallet" with orange top border; "View history →" (hidden when no history); wallet history modal (Month / Net / Balance After table)

**Pending:** none

---

## Session — 2026-03-22 (To Do — drag sort fix + instant drag performance)

### What Was Done
- **Root cause fixed**: all new tasks had `sort_order=0` (DB default) → midpoint `(0+0)/2=0` → drags were no-ops
- `app/routers/todo.py`:
  - Added `from sqlalchemy import func`
  - `create_task` + `create_unassigned_task`: now query `max(sort_order)` in target zone and assign `max+1` to new tasks
  - New `POST /todo/reorder` endpoint: accepts ordered `task_ids[]` + optional `moved_task_id`/`new_column_id`; assigns `sort_order=0,1,2...`; handles cross-column moves atomically
- `frontend/src/pages/Todo.jsx`:
  - `handleDrop` replaced: computes full new zone order locally, calls `POST /todo/reorder`
  - Added `applyOptimisticReorder()`: updates `columns`/`unassigned` state instantly before API responds; rollback on error
  - Result: drag response is instant (no visible delay)

**Pending:** none

---

## Session — 2026-03-22 (To Do — drag-and-drop + Activity View + Unassigned tasks)

### What Was Done
- `app/routers/todo.py`: added `column_id: Optional[int]` to `TaskBody`; `_board()` now returns `unassigned[]` list; new `POST /todo/tasks` endpoint (creates task with `column_id=NULL`); `update_task` handles `column_id=0` → unassign
- `app/models.py`: `TodoTask.column_id` → `nullable=True`; `TodoColumn.tasks` relationship cascade changed from `all, delete-orphan` → `all` (avoid SQLAlchemy treating NULL column_id as orphan)
- Migration 0021: `ALTER COLUMN todo_tasks.column_id` → nullable
- `frontend/src/pages/Todo.jsx`:
  - HTML5 drag-and-drop on task cards; drop zones on kanban columns (accent border highlight)
  - `handleDrop(taskId, targetColId)` — `column_id=0` unassigns; searches both `columns` and `unassigned` for dragged task
  - View toggle: "☰ Kanban" | "⊞ Activity" buttons
  - Activity View: sections per activity + Untagged; CSS grid of "Unassigned" + person columns
  - "Unassigned" first column: shows tasks with `column_id=NULL` for that activity; "+" button creates unassigned task with activity pre-filled; drop zone sends `column_id=0` to unassign
  - `TaskModal` accepts `prefillActivityId` prop for pre-filling activity when opening from section

**Pending:** none

---

## Session — 2026-03-21 (To Do Kanban — done checkbox)

### What Was Done
- Migration 0020: `todo_tasks.done` Boolean NOT NULL DEFAULT false
- `app/routers/todo.py`: added `done` to `TaskBody`, `_board()`, `update_task`
- `frontend/src/pages/Todo.jsx`:
  - Extracted `TaskCard` component with circle checkbox button
  - Circle toggles done via `PUT /todo/tasks/{id}` with `done: !task.done`
  - Active tasks shown normally; done tasks hidden by default
  - Per-column "▸ Done (N)" collapsible section — expands to show done tasks with strikethrough + dimmed opacity
  - Task count badge: "N tasks · N done"

---

## Session — 2026-03-21 (To Do Kanban board)

### What Was Done

**To Do page — new Kanban board (`/todo`):**
- Migration 0019: `todo_activities` + `todo_columns` + `todo_tasks` (brand-scoped; activity_id FK uses SET NULL on delete)
- `app/routers/todo.py`: 10 endpoints — full board GET, activities CRUD, columns CRUD, tasks CRUD; all return full board on mutation
- `main.py`: registered `todo.router` before cashflow router
- `frontend/vite.config.js`: added `/todo` proxy with HTML bypass
- `frontend/src/App.jsx`: pageMeta + PERMISSIONED_PAGES + Route + NavLink (between BI Assistant and Users)
- `frontend/src/pages/Todo.jsx`: Kanban board with:
  - Activity filter pills (All + per-activity, cycling color palette)
  - Collapsible activity management panel (add/rename/delete)
  - Column cards (~260px) per person with inline rename, delete confirm
  - Task cards showing activity badge, title, deadline urgency badge, notes preview
  - Task modal (title, activity select, deadline date, notes textarea) for add/edit/delete
  - "+ Add Person" card at end of board

**Pending:** none

---

## Session — 2026-03-18 (Meta Ads fixes + Dashboard redesign)

### What Was Done

**Meta Ads — bug fixes:**
- `FB.login()` callback was `async` → FB SDK error "Expression is of type asyncfunction". Fixed by converting to `.then()/.catch()/.finally()` promise chain
- Token exchange error now surfaces actual Facebook error message (was throwing generic httpx 400)
- `get_spend_summary` + `get_campaigns` switched from `facebook_business` SDK to direct `httpx` Graph API calls — SDK was returning ~8K EGP over actual spend
- `get_account_balance` fixed for EGP accounts: Meta stores balance in a USD-based unit; correct formula is `raw / usd_egp_rate` (not `raw / 100`); fetches live rate from `frankfurter.app` (free, no key); non-EGP accounts still use `/100`

**Settings.jsx — Meta Ads card redesign:**
- Facebook logo icon in blue gradient square header
- Not-connected: dashed empty-state box, centered button with FB icon + spinner
- Connected: green pulse dot, blue-tinted badge row, cleaner layout

**Home.jsx — Dashboard redesign:**
- `KpiCard` component with 3px top accent bar per color
- All 5 financial cards (Money In, Money Out, Net, Total In, Total Out) use orange `var(--accent)`
- Meta Ads uses Facebook blue (spend) + emerald (balance)
- Section labels (month / YTD / Meta Ads)
- Period selector moved to header row
- Last report card: orange left bar, stacked sub-labels, divider for top SKU

**Meta Ads — spend date timezone bug:**
- `new Date(year, month, 1).toISOString()` in Egypt (UTC+3) shifts midnight local to Feb 28 UTC — included ~8K EGP of February spend
- Fixed in `Home.jsx` + `Analytics.jsx`: use `getFullYear()`/`getMonth()`/`getDate()` to build date strings directly, no UTC conversion
- Spend now matches Ads Manager exactly

**Pending:** none

---

## Last Session — 2026-03-18 (Meta Ads integration + Stock alert fix)

### What Was Done

**Stock Alert — daily full inventory email:**
- `app/stock_alert.py`: morning alert (`alert_time_1`) now always sends full inventory (blue header "📦 Daily Inventory Report") even when all stock is healthy
- Evening alert (`alert_time_2`) still sends low-stock-only (orange header "⚠️ Low Stock Alert")
- `_build_html` now accepts `daily_report: bool`; healthy rows get white background

**Bosta daily automation — IMAP mailbox fix:**
- `automation/bosta_daily.py`: changed `mail.select("inbox")` → `mail.select('"[Gmail]/All Mail"')` — Bosta export emails land in Promotions, not Inbox
- `upload_to_ecomhq` now returns `(result, brand_token)` tuple
- New `set_meta_ads_spent(brand_token, report_id, date_from, date_to)` — calls `/meta/summary` + `PUT /reports/{id}/pl` after upload to auto-fill ads_spent

**Meta Ads API integration (full):**
- `app/meta_client.py` (new): `facebook-business` SDK wrapper — `exchange_token`, `get_user_name`, `get_ad_accounts`, `get_spend_summary`, `get_account_balance`, `get_campaigns`
- `app/routers/meta.py` (new): 8 endpoints (see API contract)
- `main.py`: registered `meta.router`
- `app/routers/settings.py` `GET /settings`: now returns `meta_connected`, `meta_connected_name`, `meta_ad_account_id` (token never exposed)
- `app/routers/bi.py` `_build_snapshot()`: adds `meta_ads_last_30_days` section when connected
- `requirements.txt`: added `facebook-business`
- `frontend/src/pages/Settings.jsx`: new "Meta Ads Integration" card — FB popup OAuth, ad account picker, connected/disconnect UI; no manual token UI
- `frontend/src/pages/Home.jsx`: Meta spend + balance remaining stat chips (current month, shown when connected)
- `frontend/src/pages/Analytics.jsx`: "Meta Campaigns" card with date range pickers and table (Campaign / Results / CPR / Amount Spent / Purchase ROAS)
- `frontend/src/pages/BostaOrders.jsx`: adsSpent `type="number"` → `type="text"`; auto-fills from `/meta/summary` when report loads with no saved ads_spent
- `frontend/.env`: `VITE_META_APP_ID=1338653400940878` for local dev
- `Dockerfile`: `ARG VITE_META_APP_ID` + `ENV VITE_META_APP_ID=$VITE_META_APP_ID` in Stage 1 so Railway passes it as build arg

**Pending:**
- User must add `VITE_META_APP_ID`, `META_APP_ID`, `META_APP_SECRET` to Railway Variables tab
- User must add `ecom-production-a643.up.railway.app` to Facebook App Domains + OAuth redirect URIs in Meta Developer console
- Redeploy Railway after adding variables

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
