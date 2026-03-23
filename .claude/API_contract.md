# API Contract
<!-- AGENT INSTRUCTIONS: Update this file whenever you add, modify, or remove an API endpoint.
     Keep request/response shapes in sync with main.py. -->

## Auth & Identity

### POST /auth/register
- **Auth:** Bearer + require_admin + brand in JWT (viewers assigned to admin's current brand)
- **Body:** FormData — `email`, `password`, `role` (admin|viewer), `name` (optional), `read_only` (optional, "true"/"false"), `allowed_pages` (optional, JSON array of paths)
- **Response:** `{ ok, email, role }`
- **Errors:** 400 if email already registered or invalid role; 403 if no brand selected

### POST /auth/login
- **Auth:** None
- **Body:** FormData (OAuth2) — `username` (email), `password`
- **Response:** `{ access_token, token_type: "bearer", role, brand_id }`
- **Note:** Admin gets `brand_id: null` (must pick brand). Viewer gets their `brand_id`.
- **Errors:** 401 if invalid credentials

### GET /auth/me
- **Auth:** Bearer token (any role)
- **Response:** `{ email, role, name, brand_id, brand_name, allowed_pages, allowed_brand_ids, read_only }`

### POST /auth/select-brand
- **Auth:** Bearer + require_admin (no brand required)
- **Body:** JSON — `{ brand_id: int }`
- **Response:** `{ access_token }` — new JWT with chosen brand_id embedded
- **Errors:** 404 if brand not found

### POST /auth/clear-brand
- **Auth:** Bearer + require_admin (no brand required)
- **Response:** `{ access_token }` — new JWT with brand_id=null (returns admin to brand picker)

### PUT /users/me
- **Auth:** Bearer token (any role — updates own name)
- **Body:** JSON — `{ name: string }`
- **Response:** `{ ok, name }`

---

---

## Admin (Admin Only, No Brand Required)

### GET /admin/brand-settings
- **Auth:** Bearer + require_admin (no brand_id needed)
- **Response:** array of brands with Bosta credentials configured:
  ```json
  [{ "brand_id": 1, "brand_name": "Zen", "bosta_email": "...", "bosta_password": "...", "bosta_api_key": "...", "bosta_email_password": "..." }]
  ```
- **Note:** Only returns brands where `bosta_email` is set. Used by `automation/bosta_daily.py`.

### GET /admin/overview
- **Auth:** Bearer + require_admin (no brand_id needed)
- **Response:** array of brand KPI objects:
  ```json
  [{
    "brand_id": 1, "brand_name": "Zen",
    "users_count": 3, "products_count": 15,
    "cashflow_months_count": 1, "cashflow_entries_total": 32,
    "current_month_in": 50000.0, "current_month_out": 20000.0, "current_month_net": 30000.0,
    "bosta_reports_count": 5, "last_report_date": "Mar 2026"
  }]
  ```
- **Note:** `current_month_*` is for the current calendar month (e.g. "Mar 2026"). `last_report_date` is nullable.

### GET /admin/admins
- **Auth:** Bearer + require_admin (no brand_id needed)
- **Response:** `AdminUser[]`
  ```
  { id, email, name, role, created_at, allowed_brand_ids, is_self }
  ```
- **Notes:** Only users with role `admin` are returned. `allowed_brand_ids = null` means all brands.

### PUT /admin/admins/{id}/brands
- **Auth:** Bearer + require_admin (no brand_id needed)
- **Body:** JSON — `{ allowed_brand_ids: int[] | null }` (null = all brands)
- **Response:** `{ ok: true }`
- **Errors:** 404 if admin not found; 400 if trying to edit non-admin

### DELETE /admin/admins/{id}
- **Auth:** Bearer + require_admin (no brand_id needed)
- **Response:** `{ ok: true }`
- **Errors:** 404 if admin not found; 400 if trying to delete self

---

## Brands (Admin Only, No Brand Required)

### GET /brands
- **Auth:** Bearer + require_admin
- **Response:** `BrandOut[]` — `[{ id, name }]`

### POST /brands
- **Auth:** Bearer + require_admin
- **Body:** JSON — `{ name: string }`
- **Response:** `{ id, name }`
- **Errors:** 400 if name empty or already exists

### DELETE /brands/{brand_id}
- **Auth:** Bearer + require_admin
- **Response:** `{ ok: true }`
- **Errors:** 404 if not found; 400 if brand has existing data (cashflow/products/reports)

---

## Products *(brand-scoped)*

### GET /products
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `{ [sku]: name }` — plain object map, filtered by brand

### POST /products
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** JSON — `{ sku: string, name: string }`
- **Response:** `{ ok, sku, name }`
- **Note:** Upsert — updates name if (sku, brand_id) already exists

### DELETE /products/{sku}
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `{ ok: true }`
- **Errors:** 404 if SKU not found in this brand

---

## Cashflow *(brand-scoped)*

### GET /cashflow/months
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `string[]` — list of month names e.g. `["Jan 2026", "Feb 2026"]`

### POST /cashflow/months
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** JSON — `{ month: string }`
- **Response:** `{ ok, months: string[] }`
- **Side effect:** If month is new, snapshots previous month's net into `wallet_entries`

### GET /cashflow/wallet
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `{ balance: float, history: [{ month_name, month_net, balance_after, created_at }] }` — newest first
- **Note:** Registered before `GET /cashflow/{month}` to avoid route shadowing

### GET /cashflow/{month}
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `CashflowEntry[]`
  ```
  { id, date, type ("in"|"out"), amount, category, notes }
  ```

### POST /cashflow/{month}/entries
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** JSON — `{ id, date, type, amount, category, notes }`
- **Response:** `{ ok, rows: CashflowEntry[] }` — full updated list

### PUT /cashflow/{month}/entries/{entry_id}
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** JSON — `{ date, type, amount, category, notes }`
- **Response:** `{ ok, rows: CashflowEntry[] }`
- **Errors:** 404 if month or entry not found (within brand)

### DELETE /cashflow/{month}/entries/{entry_id}
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `{ ok, rows: CashflowEntry[] }`
- **Note:** Soft-copies entry to `deleted_cashflow_entries` (with brand_id) before deletion

---

## Bosta Reports *(brand-scoped)*

### POST /upload
- **Auth:** Bearer + require_writable + brand in JWT
- **Body:** FormData — `file` (.xlsx/.xls), `date_from` (YYYY-MM-DD, optional), `date_to` (optional)
- **Response:** `{ rows, grand_quantity, grand_revenue, order_count, report_id }`
  Where each row: `{ sku, name, prices: [{price, quantity, total}], total_quantity, total_revenue }`
- **Errors:** 400 if not Excel or no Description column

### GET /reports
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `ReportSummary[]` (no rows_json):
  ```
  { id, uploaded_at, date_from, date_to, order_count, grand_quantity, grand_revenue }
  ```

### GET /reports/{report_id}
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** Full report including `rows` array
- **Errors:** 404 if not found (or not in this brand)

---

## Dashboard *(brand-scoped)*

### GET /dashboard/summary?month={month}
- **Auth:** Bearer (any role) + brand in JWT
- **Query:** `month` — e.g. "Mar 2026" (optional, defaults to current month)
- **Response:**
  ```
  { this_month_in, this_month_out, this_month_net,
    total_in_ytd, total_out_ytd, ytd_net,
    last_report: { uploaded_at, order_count, grand_revenue } | null,
    last_report_profit: float | null,
    last_report_profit_pct: float | null,
    top_sku: { sku, name, total_quantity } | null,
    current_month }
  ```

### GET /dashboard/trend
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** All cashflow months in chronological order:
  ```json
  [{ "month": "Jan 2026", "money_in": 50000.0, "money_out": 20000.0, "net": 30000.0 }]
  ```

### GET /dashboard/bosta-summary
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** Latest Bosta report P&L aggregates (or `null` if no report):
  ```json
  {
    "report_id": 1,
    "uploaded_at": "2026-03-10T12:00:00",
    "date_from": "2026-03-01", "date_to": "2026-03-10",
    "order_count": 120,
    "grand_revenue": 85000.0,
    "gross_profit": 30000.0,
    "profit_pct": 35.29,
    "ads_spent": 5000.0,
    "roas": 17.0
  }
  ```

---

## User Management (Admin + Brand) *(brand-scoped)*

### GET /users
- **Auth:** Bearer + require_admin + brand in JWT
- **Response:** `User[]` — only users belonging to this brand
  ```
  { id, email, name, role, created_at, allowed_pages, read_only }
  ```

### PUT /users/{user_id}
- **Auth:** Bearer + require_admin
- **Body:** JSON — `{ name: string }`
- **Response:** `{ ok, name }`
- **Errors:** 404 if user not found

### PUT /users/{user_id}/pages
- **Auth:** Bearer + require_admin
- **Body:** JSON — `{ allowed_pages: string[] | null }` (null = unrestricted)
- **Response:** `{ ok: true }`
- **Errors:** 404 if user not found

### PUT /users/{user_id}/readonly
- **Auth:** Bearer + require_admin
- **Body:** JSON — `{ read_only: bool }`
- **Response:** `{ ok: true }`
- **Errors:** 404 if user not found

### DELETE /users/{user_id}
- **Auth:** Bearer + require_admin
- **Response:** `{ ok: true }`
- **Errors:** 404 if not found, 400 if trying to delete self

---

## Products Sold *(brand-scoped)*

### GET /products-sold/{month}
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** Array of products with merged Bosta + manual data:
  ```
  { sku, name, price, cost, extra_cost, qty, revenue, expense, profit, profit_pct }
  ```

### PUT /products-sold/{month}/{sku}
- **Auth:** Bearer + require_writable + brand in JWT
- **Body:** JSON — `{ price, cost, extra_cost, expense }` (all nullable floats)
- **Response:** `{ ok: true }`

---

## Settings *(brand-scoped)*

### GET /settings
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `{ bosta_api_key, bosta_email, bosta_password, bosta_email_password }`
- **Note:** Read-only for non-admin users.

### PUT /settings
- **Auth:** Bearer + require_admin + brand in JWT
- **Body:** JSON — `{ bosta_api_key: string | null, bosta_email: string | null, bosta_password: string | null, bosta_email_password: string | null }`
- **Response:** `{ ok: true }`

---

## Stock Value *(brand-scoped)*

### GET /stock-value
- **Auth:** Bearer (any role) + brand in JWT
- **Source:** Bosta `GET /api/v2/products/fulfillment/list-products` (paginated, single call)
- **Response:**
  ```json
  {
    "rows": [{
      "sku": "BO-12345",
      "name": "Product Name",
      "consumer_price": 250.0,
      "purchase_price": 120.0,
      "on_hand": 10,
      "reserved": 2,
      "consumer_value": 2500.0,
      "purchase_value": 1200.0,
      "units_sold": 30,
      "avg_daily_sales": 3.0,
      "days_remaining": 3,
      "sell_through": 75.0
    }],
    "total_onhand": 10,
    "total_consumer_value": 2500.0,
    "total_purchase_value": 1200.0,
    "capital_trapped": 0.0,
    "report_days": 10
  }
  ```
- **Notes:** `units_sold`/`avg_daily_sales`/`days_remaining`/`sell_through` are null/0 when no Bosta report exists. `sell_through` = `units_sold / (units_sold + on_hand) * 100`. `capital_trapped` = purchase value of SKUs with sell_through < 20%.
- **Errors:** 400 if no Bosta API key set; 502 if Bosta API unreachable or returns error

### PUT /stock-value/purchase-price
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** `{ sku: string, price: float }`
- **Response:** `{ ok: true }`
- **Note:** Upserts `stock_purchase_prices` for the current brand's SKU

---

## SKU Cost Items *(brand-scoped)*

### GET /sku-cost-items
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `{ [sku]: [{ name: string, amount: float }] }` — all items for this brand, grouped by SKU

### PUT /sku-cost-items/{sku}
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** `[{ name: string, amount: float }]` — full replace (deletes existing rows for this SKU, inserts new ones)
- **Response:** `{ ok: true }`
- **Note:** Items are global per brand/SKU — not per-report. Used for itemised cost breakdown in P&L table.

---

## BI Assistant *(brand-scoped)*

### POST /bi/ask
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** `{ question: string }`
- **Behavior:** Builds bounded data snapshot (cashflow last 6 months, top expense categories, latest Bosta report summary + top SKUs, live stock inventory top 30 via Bosta API), calls Gemini 2.5 Flash, saves Q/A to `bi_insights`, returns answer
- **Response:** `{ id, answer, created_at }`
- **Errors:** 400 if `GEMINI_API_KEY` not set; 502 if Gemini API fails

### GET /bi/history
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `[{ id, question, answer, created_at }]` — latest 50 for current brand, newest first

---

## SMS & Bosta Payout Suggestions *(brand-scoped)*

### POST /sms/intake?token=xxx
- **Auth:** No JWT — token-gated (token stored in `app_settings` key `sms_webhook_token`)
- **Body:** JSON — `{ body: string }` — raw SMS text from iOS Shortcut
- **Behavior:** Calls `parse_cib_sms()` — handles Instant Transfer, IPN Transfer, Debit Card Purchase; creates `SmsSuggestion` with `type='out'`; dedup by `ref_number`
- **Response:** `{ ok, id, parsed }` on success; `{ ok: false, reason: "unrecognised", received: "..." }` if parser fails; `{ ok: true, duplicate: true, id }` if already exists
- **Errors:** 403 if token invalid

### GET /sms/token
- **Auth:** Bearer + require_admin + brand in JWT
- **Response:** `{ token, intake_url }`

### POST /sms/token/regenerate
- **Auth:** Bearer + require_admin + brand in JWT
- **Response:** `{ token, intake_url }`

### POST /sms/check-bosta-payouts
- **Auth:** Bearer + require_admin + brand in JWT
- **Behavior:** Connects to Gmail IMAP (`[Gmail]/All Mail`), searches `FROM no-reply@bosta.co` since `bosta_payout_days` days ago (default 2, configurable in Settings); filters by "Cashout" subject; parses amount (Arabic-Indic numerals) + invoice number; creates `type='in'`, `category='Bosta'` suggestions; dedup skips pending/accepted only — dismissed suggestions are reset to pending
- **Response:** `{ emails_found, subject_matched, new, error, payout_days }`
- **Response:** `{ ok: true, emails_found: int, new: int, error: string|null }`

### GET /cashflow/sms-suggestions
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `[{ id, amount, description, ref_number, tx_date, created_at, type, category }]` — pending only, newest first

### POST /cashflow/sms-suggestions/{id}/accept
- **Auth:** Bearer + require_writable + brand in JWT
- **Body:** `{ month: string, category: string, notes: string, amount: float|null }`
- **Behavior:** Creates `CashflowEntry` using `suggestion.type` and `body.category || suggestion.category`; marks suggestion `accepted`
- **Response:** `{ ok: true, entry_id }`

### POST /cashflow/sms-suggestions/{id}/dismiss
- **Auth:** Bearer (any role) + brand in JWT
- **Behavior:** Sets `status='dismissed'` — row kept in DB
- **Response:** `{ ok: true }`

---

## Meta Ads

### GET /meta/config
- **Auth:** Bearer (any role)
- **Response:** `{ app_id: string }` — Facebook App ID for JS SDK init
- **Errors:** 503 if `META_APP_ID` not set on server

### GET /meta/status
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** `{ connected: bool, connected_name: string, ad_account_id: string }`

### POST /meta/auth
- **Auth:** Bearer + require_admin + brand in JWT
- **Body:** `{ access_token: string }` — short-lived token from FB JS SDK
- **Behavior:** Exchanges for long-lived (60-day) token; saves `meta_access_token` + `meta_connected_name` to AppSettings; returns ad accounts list
- **Response:** `{ ok: true, connected_name: string, ad_accounts: [{ id, name, currency, status }] }`
- **Errors:** 400 Meta API error; 503 if `META_APP_ID`/`META_APP_SECRET` not set

### POST /meta/auth/manual
- **Auth:** Bearer + require_admin + brand in JWT
- **Body:** `{ access_token: string }` — pre-existing long-lived token
- **Behavior:** Validates token via `get_user_name`; saves directly (no exchange)
- **Response:** `{ ok: true, connected_name: string, ad_accounts: [...] }`

### POST /meta/select-account
- **Auth:** Bearer + require_admin + brand in JWT
- **Body:** `{ ad_account_id: string }` — e.g. `"act_1234567890"`
- **Behavior:** Saves `meta_ad_account_id` to AppSettings
- **Response:** `{ ok: true }`

### DELETE /meta/disconnect
- **Auth:** Bearer + require_admin + brand in JWT
- **Behavior:** Deletes `meta_access_token`, `meta_ad_account_id`, `meta_connected_name` from AppSettings
- **Response:** `{ ok: true }`

### GET /meta/summary
- **Auth:** Bearer (any role) + brand in JWT
- **Query params:** `date_from`, `date_to` (ISO strings, optional — default current month)
- **Response (connected):** `{ connected: true, spend: float, balance: float, currency: string, date_from, date_to }`
- **Response (not connected):** `{ connected: false, spend: 0, balance: 0, currency: "EGP" }`
- **Errors:** 502 on Meta API error

### GET /meta/campaigns
- **Auth:** Bearer (any role) + brand in JWT
- **Query params:** `date_from`, `date_to` (ISO strings, optional — default current month)
- **Response (connected):** `{ connected: true, rows: [{ campaign_name, results, cpr, spend, roas }], date_from, date_to }`
- **Response (not connected):** `{ connected: false, rows: [] }`
- **Errors:** 502 on Meta API error

---

## To Do Board *(brand-scoped)*

**Full board shape** (returned by all mutating endpoints):
```json
{
  "activities": [{ "id": 1, "name": "R&D" }],
  "columns": [{ "id": 1, "name": "Ahmed", "tasks": [{ "id": 1, "column_id": 1, "title": "...", "deadline": "YYYY-MM-DD|null", "notes": "...|null", "done": false, "activity_id": 1, "activity_name": "R&D", "sort_order": 0 }] }],
  "unassigned": [{ "id": 5, "column_id": null, ... }]
}
```
**Note:** `column_id` on tasks is nullable (NULL = unassigned, not yet assigned to a person).

### GET /todo
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** Full board (see shape above)

### POST /todo/activities
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** `{ name: string }`
- **Response:** Full board
- **Errors:** 400 if name empty or already exists

### PUT /todo/activities/{act_id}
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** `{ name: string }`
- **Response:** Full board

### DELETE /todo/activities/{act_id}
- **Auth:** Bearer (any role) + brand in JWT
- **Behavior:** Deletes activity; tasks with this activity_id have activity_id set to NULL (SET NULL FK)
- **Response:** Full board

### POST /todo/columns
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** `{ name: string }`
- **Response:** Full board
- **Errors:** 400 if name empty or already exists

### PUT /todo/columns/{col_id}
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** `{ name: string }`
- **Response:** Full board

### DELETE /todo/columns/{col_id}
- **Auth:** Bearer (any role) + brand in JWT
- **Behavior:** Cascade deletes all tasks in this column
- **Response:** Full board

### POST /todo/tasks *(new — creates unassigned task)*
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** `{ title: string, deadline: string|null, notes: string|null, activity_id: int|null }`
- **Response:** Full board — task appears in `unassigned[]`

### POST /todo/columns/{col_id}/tasks
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** `{ title: string, deadline: string|null, notes: string|null, activity_id: int|null }`
- **Response:** Full board

### PUT /todo/tasks/{task_id}
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** `{ title, deadline, notes, activity_id, done?, column_id? }`
  - `column_id` omitted or null → no change to assignment
  - `column_id: 0` → unassign (set column_id to NULL)
  - `column_id: N` → reassign to column N
- **Response:** Full board

### POST /todo/reorder
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** `{ task_ids: int[], moved_task_id?: int, new_column_id?: int }`
  - `task_ids`: full ordered list for the target zone → assigned `sort_order=0,1,2,...`
  - `moved_task_id` + `new_column_id`: only on cross-column moves; `new_column_id=0` unassigns
- **Response:** Full board
- **Note:** Preferred over PUT for all drag reorder operations

### DELETE /todo/tasks/{task_id}
- **Auth:** Bearer (any role) + brand in JWT
- **Response:** Full board

---

## Debug

### POST /debug-upload
- **Auth:** None
- **Body:** FormData — `file`
- **Response:** `{ headers, delivered_at_index, samples }` — for diagnosing Excel column issues
