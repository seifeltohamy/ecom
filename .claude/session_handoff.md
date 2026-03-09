# Session Handoff
<!-- AGENT INSTRUCTIONS: Update the "Last Session" and "Current State" sections at the end
     of every significant session. Prepend new entries — most recent at the top. -->

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
