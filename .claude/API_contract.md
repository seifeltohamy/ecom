# API Contract
<!-- AGENT INSTRUCTIONS: Update this file whenever you add, modify, or remove an API endpoint.
     Keep request/response shapes in sync with main.py. -->

## Auth & Identity

### POST /auth/register
- **Auth:** None (admin creates users via UI which passes token, but endpoint itself is open)
- **Body:** FormData — `email`, `password`, `role` (admin|viewer), `name` (optional)
- **Response:** `{ ok, email, role }`
- **Errors:** 400 if email already registered or invalid role

### POST /auth/login
- **Auth:** None
- **Body:** FormData (OAuth2) — `username` (email), `password`
- **Response:** `{ access_token, token_type: "bearer", role }`
- **Errors:** 401 if invalid credentials

### GET /auth/me
- **Auth:** Bearer token (any role)
- **Response:** `{ email, role, name }`

### PUT /users/me
- **Auth:** Bearer token (any role — updates own name)
- **Body:** JSON — `{ name: string }`
- **Response:** `{ ok, name }`

---

## Products

### GET /products
- **Auth:** Bearer (any role)
- **Response:** `{ [sku]: name }` — plain object map

### POST /products
- **Auth:** Bearer (any role)
- **Body:** JSON — `{ sku: string, name: string }`
- **Response:** `{ ok, sku, name }`
- **Note:** Upsert — updates name if SKU already exists

### DELETE /products/{sku}
- **Auth:** Bearer (any role)
- **Response:** `{ ok: true }`
- **Errors:** 404 if SKU not found

---

## Cashflow

### GET /cashflow/months
- **Auth:** Bearer (any role)
- **Response:** `string[]` — list of month names e.g. `["Jan 2026", "Feb 2026"]`

### POST /cashflow/months
- **Auth:** Bearer (any role)
- **Body:** JSON — `{ month: string }`
- **Response:** `{ ok, months: string[] }`

### GET /cashflow/{month}
- **Auth:** Bearer (any role)
- **Response:** `CashflowEntry[]`
  ```
  { id, date, type ("in"|"out"), amount, category, notes }
  ```

### POST /cashflow/{month}/entries
- **Auth:** Bearer (any role)
- **Body:** JSON — `{ id, date, type, amount, category, notes }`
- **Response:** `{ ok, rows: CashflowEntry[] }` — full updated list

### PUT /cashflow/{month}/entries/{entry_id}
- **Auth:** Bearer (any role)
- **Body:** JSON — `{ date, type, amount, category, notes }`
- **Response:** `{ ok, rows: CashflowEntry[] }`
- **Errors:** 404 if month or entry not found

### DELETE /cashflow/{month}/entries/{entry_id}
- **Auth:** Bearer (any role)
- **Response:** `{ ok, rows: CashflowEntry[] }`
- **Note:** Soft-copies entry to `deleted_cashflow_entries` before deletion

---

## Bosta Reports

### POST /upload
- **Auth:** Bearer (any role)
- **Body:** FormData — `file` (.xlsx/.xls), `date_from` (YYYY-MM-DD, optional), `date_to` (optional)
- **Response:** Report object:
  ```
  { rows, grand_quantity, grand_revenue, order_count, report_id }
  ```
  Where each row: `{ sku, name, prices: [{price, quantity, total}], total_quantity, total_revenue }`
- **Errors:** 400 if not Excel or no Description column

### GET /reports
- **Auth:** Bearer (any role)
- **Response:** `ReportSummary[]` (no rows_json):
  ```
  { id, uploaded_at, date_from, date_to, order_count, grand_quantity, grand_revenue }
  ```

### GET /reports/{report_id}
- **Auth:** Bearer (any role)
- **Response:** Full report including `rows` array
- **Errors:** 404 if not found

---

## Dashboard

### GET /dashboard/summary?month={month}
- **Auth:** Bearer (any role)
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

## User Management (Admin Only)

### GET /users
- **Auth:** Bearer + require_admin
- **Response:** `User[]`
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

## Debug

### POST /debug-upload
- **Auth:** None
- **Body:** FormData — `file`
- **Response:** `{ headers, delivered_at_index, samples }` — for diagnosing Excel column issues
