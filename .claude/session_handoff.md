# Session Handoff
<!-- AGENT INSTRUCTIONS: Update the "Last Session" and "Current State" sections at the end
     of every significant session. Prepend new entries — most recent at the top. -->

---

## Last Session — 2026-03-11 (continued, part 2)

### What Was Done

#### Bosta Stock Value — fulfillment endpoint swap
- Replaced 2-step API approach (`GET /api/v2/products` list + N `GET /api/v2/products/{id}` detail calls) with single paginated call to `GET /api/v2/products/fulfillment/list-products`
- Field mapping: `product_code → sku`, `list_price → consumer_price`, `qty_available → on_hand`, `virtual_available → reserved`
- Backend-only change; frontend response shape updated to match

#### Stock Value — Consumer Price & Purchase Price
- **Migration 0012** (`stock_purchase_prices` table): `(brand_id, sku) → purchase_price Float`, unique on `(brand_id, sku)`, index on `brand_id`. Applied locally.
- **`app/models.py`**: added `StockPurchasePrice` model
- **`GET /stock-value`**: now returns per-row `consumer_price`, `consumer_value`, `purchase_price`, `purchase_value` + totals `total_consumer_value`, `total_purchase_value`
- **`PUT /stock-value/purchase-price`** (body: `{sku, price}`): upserts purchase price for a SKU per brand
- **`frontend/src/pages/StockValue.jsx`**: editable Purchase Price column (blue tint, auto-saves on blur/Enter), Purchase Value column, totals for both in footer, summary cards for Consumer Value + Purchase Value

### Current State
- All migrations applied through 0012
- Stock Value page now shows both Consumer and Purchase perspectives
- All changes pushed to GitHub

---

## Last Session — 2026-03-11 (continued)

### What Was Done

#### DB Indexes — Migration 0011
- Created `alembic/versions/0011_add_indexes.py` — 7 new indexes:
  - `cashflow_months.brand_id`, `bosta_reports.brand_id`, `bosta_reports.uploaded_at`
  - `cashflow_categories.brand_id`, `products.brand_id`, `users.brand_id`, `cashflow_entries.created_at`
- Migration applied successfully

#### Admin Overview Portal
- **`GET /admin/overview`** (`main.py`): admin-only, no brand required. Loops over all brands, aggregates per brand: users_count, products_count, cashflow_months_count, cashflow_entries_total, current_month_in/out/net, bosta_reports_count, last_report_date
- **`frontend/src/pages/AdminPortal.jsx`**: standalone page (no sidebar), full-width table showing all brand KPIs. "Select →" button per row calls `POST /auth/select-brand` → updates JWT → navigates to `/`
- **`App.jsx`**:
  - `ProtectedRoute` now allows `/admin` when admin has no brand (`location.pathname !== '/admin'` guard)
  - `<Route path="admin" element={<AdminPortal />} />` added inside `ProtectedRoute` but **outside** `<Layout>` (no sidebar)
  - `pageMeta` entry added for `/admin`
- **`BrandPicker.jsx`**: "View Overview →" button added above brand list (admin only)
- **`vite.config.js`**: `/admin` proxy added with SPA bypass

### Current State
- All migrations applied through 0011
- Admin portal live at `/admin` — accessible from brand picker without selecting a brand
- 7 new DB indexes improve query performance as data grows
- No blocking issues

---

## Last Session — 2026-03-11

### What Was Done

#### Excel-Style P&L Formula Editor (BostaOrders.jsx)
- Removed upper Sales Breakdown table — P&L table is the single source of truth
- `evalFormula(input, ctx)` — pure function: replaces `price`/`qty`/`revenue` variables, validates with regex, evaluates via `new Function`
- `PlEditCell` — text input with `inputRef`, `draftRef`, `insertAtCursor(varName)`. Formula mode activates when draft starts with `=`; shows `ƒ` badge + computed value when not editing; 8×8 orange fill handle on hover
- `RefTd` — wraps Price/Qty/Revenue `<td>`: when `formulaActive.sku === row.sku`, adds blue outline + floating label; `onMouseDown` inserts variable at cursor without stealing focus
- `formulaActive` state: `{ sku, insert } | null` — tracks which row is in formula mode
- Fill-drag: mousedown on handle → track `hoverIdx` → mouseup applies raw string to range; each row re-evaluates independently
- Autosave: `plRef`/`adsSpentRef` refs prevent stale closures; `skipAutosaveRef` prevents fire on initial report load; 1.5s debounce
- Save/load: formula strings stored in `cost_formula`/`extra_cost_formula` DB columns; computed floats in `cost`/`extra_cost`

#### Backend / DB Changes
- Migration `0008_pl_formulas`: added `cost_formula TEXT` and `extra_cost_formula TEXT` to `bosta_report_pl`
- `app/models.py` `BostaReportPl`: added `cost_formula`, `extra_cost_formula` columns
- `main.py` `ReportPlItem` schema: added `cost_formula`, `extra_cost_formula`; both P&L endpoints updated

#### Categories Page (new)
- `frontend/src/pages/Categories.jsx` — two-column layout (Money In / Money Out)
- `CategoryItem`: click to rename inline, × to delete
- `CategoryColumn`: list + add form + "Load defaults" button when list is empty
- Defaults for Money In: Kashier, Bosta, Instapay (Money Out: none, user adds manually)
- Full CRUD via `GET/POST/PUT/DELETE /categories` + `PUT /categories/reorder/{type}`
- `CashflowCategory` model added to `app/models.py`; migration `0009_cashflow_categories`
- `App.jsx`: added `/categories` route + nav link + `pageMeta` entry
- `vite.config.js`: added `/categories` proxy entry

#### Cashflow Page — DB-backed Categories
- Removed import of hardcoded `moneyInCategories`/`moneyOutCategories` from `constants.js`
- Fetches `GET /categories` on mount; filters by type for each dropdown
- When no categories exist: shows free-text `<input>` as fallback (users never fully blocked)

### Current State
- All migrations applied (0007, 0008, 0009)
- Multi-tenant cashflow issue root cause: `cashflow_categories` table empty → dropdown empty → form blocked. Fixed by DB-backed categories + free-text fallback + Load defaults button
- No blocking issues

---

## Last Session — 2026-03-10

### What Was Done

#### Bosta Stock Value — API Debugging & Fixes
- Diagnosed 400 "Product not found" (errorCode 16000): wrong endpoint `/products/list`
- Correct endpoint: `GET /api/v2/products` (paginated list) + `GET /api/v2/products/{id}` (per-product detail)
- Fixed 401: Bosta auth is raw key with NO Bearer prefix (`Authorization: <api_key>`)
- Fixed `httpx.get() unexpected keyword 'json'`: replaced with plain `httpx.get()` (no body needed for list)
- Fixed wrong SKUs (internal IDs instead of BO-XXXXXX): non-variant products lack `bostaSku` in list endpoint — now fetches each product individually via `/api/v2/products/{id}` to get correct `bostaSku` + `productsVariances`
- Using `variantQuantity` for on_hand (variants) and `quantity` for non-variant products
- **Known issue**: `variantQuantity` doesn't match Bosta dashboard "Onhand Quantity" (e.g. Bamboo Black: API=4, dashboard=11). Root cause unknown — different inventory systems. `totalOnhand` field exists in API but returns 0 for all variants.
- Vite proxy `bypass` fix: `/stock-value`, `/settings`, `/products-sold` browser-navigations were returning raw JSON — fixed with `bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : null`

#### StockValue Page — Sortable Columns
- All columns now sortable (click header → asc/desc toggle, shows ↑/↓/↕)
- Columns: SKU, Product Name, On Hand, Reserved, Price (EGP), Stock Value (EGP)
- Removed Forecasted column (API fields `totalOnhand`/`totalForcasted` return 0 for all; added briefly then removed per user request)

### Current State
- Stock Value page works and displays live Bosta inventory with correct BO- SKUs
- Quantities may differ from Bosta dashboard (API limitation — unresolved)
- No pending in-progress features

---

## Last Session — 2026-03-09 (continued)

### What Was Done

#### EcomHQ Rebrand
- Project renamed from "Zen Finance" → **EcomHQ** across all frontend files
- `frontend/index.html` title → "EcomHQ"
- `App.jsx`: topbar + sidebar "Zen Finance" → "EcomHQ", logo letter "Z" → "HQ"
- `BrandPicker.jsx`: logo letter "Z" → "HQ"

#### Login Page Redesign
- Two-column layout: left hero panel + right form panel
- Hero: gradient "HQ" logo, "Your Ecommerce HQ" heading, 3 feature bullets
  (📦 Stock inventory · 💰 Finances & cashflow · 📊 Ads analytics)
- Mobile (<700px): hero hidden, form full width, compact mobile logo shown above form
- CSS classes added: `.login-hero`, `.login-form-panel`, `.login-mobile-logo` in `index.css`

#### Auth Race Condition Fix
- **Bug:** Selecting a brand in BrandPicker caused immediate redirect back to `/select-brand`
  because `navigate('/')` ran before `/auth/me` resolved, so `ProtectedRoute` saw `brandId=null`
- **Fix:** `AuthContext.login()` now decodes the JWT payload synchronously (base64 → JSON)
  and sets `brandId`, `role`, `brandName` before triggering the async `/auth/me` refetch
  → `ProtectedRoute` sees the correct state in the same render cycle

---

## Last Session — 2026-03-09

### What Was Done

#### Multi-Tenant Brand System (full implementation)
- New `brands` table (id, name, created_at); seed "Zen" brand via migration
- `brand_id` FK added to: `users`, `products`, `cashflow_months`, `bosta_reports`,
  `app_settings` (composite PK now `(key, brand_id)`), `products_sold_manual`, `deleted_cashflow_entries`
- Migration `0006_multi_tenant.py` — backfills all existing data to brand_id=1, sets admin users to NULL
- `get_brand_id` dep in `app/deps.py` — extracts brand_id from JWT, raises 403 if null
- All business endpoints now filter by `brand_id: int = Depends(get_brand_id)`
- New endpoints: `GET/POST /brands`, `DELETE /brands/{id}`, `POST /auth/select-brand`, `POST /auth/clear-brand`
- `POST /auth/login` now includes `brand_id` + `brand_name` in JWT (admin gets null, viewer gets theirs)
- `GET /auth/me` now returns `brand_id` + `brand_name` from JWT
- `POST /auth/register` now requires admin auth + auto-assigns brand_id to new viewers
- Frontend `AuthContext.jsx` — added `brandId`, `brandName` state, populated from `/auth/me`
- `ProtectedRoute` updated — admin with `brandId===null` → redirect to `/select-brand`
- New `BrandPicker.jsx` — standalone page to select/create brands; no sidebar layout
- Sidebar brand badge — shows active brand name + "Switch Brand" button (admin only)
- "Switch Brand" calls `POST /auth/clear-brand` → null-brand token → redirects to brand picker
- Migration ran against Supabase DB successfully; backend imports verified

#### Fixes from previous session
- Bosta API auth header corrected: `{"authorization": api_key}` (no Bearer prefix)
- Login persistence: JWT expiry extended to 30 days (`ACCESS_TOKEN_EXPIRE_MINUTES=43200`)
- Expired token handling: `/auth/me` 401 → `clearToken()` → redirect to /login
- SSH key set up for GitHub pushes (macOS)

### Current State
All code committed and pushed to `main`. Railway will auto-deploy via Dockerfile.
The migration runs automatically in `start_prod.sh` (`alembic upgrade head`).

### Next Session Should
1. Verify Railway deployment with multi-tenant migration applied
2. Test admin brand picker and switch flow on production
3. Continue with: Bosta API direct integration, password change, cashflow CSV export

---

## Last Session — 2026-03-03/04

### What Was Done

#### Deployment to Railway
- Created `Dockerfile` (multi-stage: Node 20 builds frontend, Python 3.12 serves)
- Created `start_prod.sh` — runs `alembic upgrade head` then `uvicorn` on `$PORT`
- Created `.gitignore` — excludes .env, __pycache__, node_modules, frontend/dist, cashflow/, products.json
- Pushed to GitHub: `https://github.com/seifeltohamy/ecom`
- Deployed on Railway with env vars: `DATABASE_URL`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- App live at: `ecom-production-a643.up.railway.app`

#### Products Sold page (`/products-sold`)
- New DB table: `products_sold_manual` (migration `0004_products_sold.py`)
- `GET /products-sold/{month}` — merges products + Bosta report + manual DB data
- `PUT /products-sold/{month}/{sku}` — upserts manual fields (price, cost, extra_cost, expense)
- `frontend/src/pages/ProductsSold.jsx` — inline-editable table, calcProfit(), summary card
- Columns: Product Name, Price, Cost, Extra Cost, Qty (Bosta), Revenue (Bosta), Expense, Profit, Profit%
- Summary card: Unit Items, Total Revenue, Total Expenses, NET PROFIT/(LOSS), Profit%

#### Stock Value page (`/stock-value`)
- Calls Bosta API live: `GET http://app.bosta.co/api/v2/products/list`
- `frontend/src/pages/StockValue.jsx` — table + summary cards (Total SKUs, Total Units, Total Stock Value)
- Refresh button, error shown if API key missing or Bosta returns error
- Bosta API token is a **static API key** from Bosta Settings → API section

#### Settings page (`/settings`, admin only)
- New DB table: `app_settings` key-value store (migration `0005_app_settings.py`)
- `GET /settings` / `PUT /settings` — stores Bosta API key in DB
- `frontend/src/pages/Settings.jsx` — password input with show/hide toggle
- Settings nav link in sidebar bottom (admin only)

#### Fixes
- Added `httpx` to requirements.txt for Bosta API calls
- Changed Bosta API URL from `https://` to `http://` to match docs
- Added `follow_redirects=True` to httpx call
- Updated `App.jsx`: new routes, nav links, pageMeta entries for all 3 new pages

### Current State
App deployed on Railway. Stock Value page working pending correct Bosta API key.
Stock Value auth uses static API key from Bosta dashboard (Settings → API section).

### Pending / Next Steps
- User needs to paste correct Bosta static API key in ⚙ Settings page
- Bosta API returns 401 if key is wrong/expired — error shown clearly in UI
- Optional backlog: password change, cashflow CSV export

---

## Last Session — 2026-03-01

### What Was Done
- Added `name` field to `User` model + Alembic migration `0003_user_name`
- Backend: `POST /auth/register` accepts optional `name`, `GET /auth/me` returns `name`,
  `PUT /users/me` updates own name, `PUT /users/{id}` (admin) updates any user's name
- Frontend `AuthContext`: added `currentUserName` state + `updateName()` function
- `App.jsx` sidebar: shows first letter of name as avatar, shows name instead of "Zen Finance"
- `Users.jsx`: name field in create form, name column in table with inline edit (pencil button)
- All pages: added loading spinner (`<Alert type="loading">`) while data fetches
- Mobile layout: hamburger topbar, fixed sidebar drawer, overlay backdrop

### Current State
App is fully working. Dev: `start.bat`. Prod: `build.bat` then uvicorn on 8080.
All 15 listed features done. See `checklist.md` for pending items.

### Pending / Next Steps
- No blocking issues
- Optional backlog: Bosta API integration, password change, cashflow CSV export

---

## Project History Summary

| Date | Milestone |
|------|-----------|
| Early 2026 | Initial single `index.html` SPA — SKU report from Excel |
| Early 2026 | Added: auth, cashflow, analytics, products, users, dashboard |
| 2026-03-01 | Migrated to Vite + React Router v6 in `frontend/` |
| 2026-03-01 | Added mobile layout, loading states, user name feature |

---

## How to Resume Work

1. Read `.claude/status.md` for stack and run instructions
2. Read `.claude/checklist.md` for what's done and what's pending
3. Read `.claude/API_contract.md` before touching any endpoint
4. Read `.claude/DB_schema.md` before touching any model or migration
5. Read `.claude/AUTH_plan.md` before touching auth logic
6. Start `start.bat` for dev, or check if server is already running on :8080 / :5173

## Admin Credentials (dev)
- Default admin: `admin@zen.com` / `Zen@2026` (set up during initial migration)
