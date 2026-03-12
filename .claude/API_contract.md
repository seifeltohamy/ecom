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
- **Auth:** Bearer (any role) + brand in JWT
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
- **Auth:** Bearer (any role) + brand in JWT
- **Body:** JSON — `{ price, cost, extra_cost, expense }` (all nullable floats)
- **Response:** `{ ok: true }`

---

## Settings *(brand-scoped, Admin Only)*

### GET /settings
- **Auth:** Bearer + require_admin + brand in JWT
- **Response:** `{ bosta_api_key: string }`

### PUT /settings
- **Auth:** Bearer + require_admin + brand in JWT
- **Body:** JSON — `{ bosta_api_key: string | null }`
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

## Debug

### POST /debug-upload
- **Auth:** None
- **Body:** FormData — `file`
- **Response:** `{ headers, delivered_at_index, samples }` — for diagnosing Excel column issues
