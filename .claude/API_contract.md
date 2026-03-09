# API Contract
<!-- AGENT INSTRUCTIONS: Update this file whenever you add, modify, or remove an API endpoint.
     Keep request/response shapes in sync with main.py. -->

## Auth & Identity

### POST /auth/register
- **Auth:** Bearer + require_admin + brand in JWT (viewers assigned to admin's current brand)
- **Body:** FormData — `email`, `password`, `role` (admin|viewer), `name` (optional)
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
- **Response:** `{ email, role, name, brand_id, brand_name }`

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
    total_in_ytd, total_out_ytd,
    last_report: { uploaded_at, order_count, grand_revenue } | null,
    top_sku: { sku, name, total_quantity } | null,
    current_month }
  ```

---

## User Management (Admin + Brand) *(brand-scoped)*

### GET /users
- **Auth:** Bearer + require_admin + brand in JWT
- **Response:** `User[]` — only users belonging to this brand
  ```
  { id, email, name, role, created_at }
  ```

### PUT /users/{user_id}
- **Auth:** Bearer + require_admin
- **Body:** JSON — `{ name: string }`
- **Response:** `{ ok, name }`
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
- **Response:**
  ```
  { rows: [{ sku, name, qty, price, stock_value }], total_qty, total_value }
  ```
- **Errors:** 400 if no Bosta API key set; 502 if Bosta API unreachable or returns error

---

## Debug

### POST /debug-upload
- **Auth:** None
- **Body:** FormData — `file`
- **Response:** `{ headers, delivered_at_index, samples }` — for diagnosing Excel column issues
