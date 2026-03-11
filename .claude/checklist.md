# Feature Checklist
<!-- AGENT INSTRUCTIONS: When you complete a feature, move it to Done and add the date.
     When starting a new feature, add it to In Progress. Keep this accurate. -->

## Done

- [x] **Vite + React migration** — Moved from CDN single-HTML to Vite + React Router v6 in `frontend/`
- [x] **Authentication** — JWT login, protected routes, role-based access (admin/viewer)
- [x] **User management (admin)** — Create, rename, delete users; name column in table
- [x] **User name field** — Shown in sidebar (letter avatar + display name); editable from Users page
- [x] **Bosta Excel upload** — Parse SKU/qty/price from Description column, date filter by "Delivered at"
- [x] **Bosta report history** — Saved to DB, listed in history table, viewable
- [x] **Products CRUD** — Add/update/delete SKUs with names; used to resolve SKUs in reports
- [x] **Cashflow — months** — Create months, switch between them
- [x] **Cashflow — entries CRUD** — Add, edit (pencil), delete (with confirm modal)
- [x] **Cashflow — monthly summary cards** — Total In / Total Out / Net above table
- [x] **Cashflow — search/filter** — Filter rows by category or notes; running balance preserved
- [x] **Analytics** — Monthly money in/out totals + money-out distribution bar chart
- [x] **Dashboard (Home)** — KPI cards (month in/out/net, YTD totals), last Bosta report, top SKU, quick links
- [x] **Mobile responsive layout** — Hamburger topbar, sidebar drawer with overlay, responsive padding
- [x] **Loading states** — All pages show spinner bar while data fetches
- [x] **ProductsSold page** — `/products-sold/{month}`, inline-editable cost/price/profit table
- [x] **StockValue page** — Live Bosta API inventory, total stock value
- [x] **Settings page** — Admin-only, saves Bosta API key per brand
- [x] **Multi-tenant brands** — brands table, brand_id FK on all tables, JWT-based isolation, BrandPicker UI, Switch Brand
- [x] **EcomHQ rebrand** — renamed from "Zen Finance"; login page redesigned with two-column hero+form layout
- [x] **Auth race fix** — login() decodes JWT synchronously so ProtectedRoute sees brandId before /auth/me resolves
- [x] **P&L Excel-style formulas** — click-to-reference (type `=` → Price/Qty/Revenue cells glow → click inserts variable), fill-drag propagates formula string, each row evaluates independently, autosave with 1.5s debounce, formula strings persisted in DB
- [x] **Categories page** — `/categories`; each brand manages Money In / Money Out cashflow categories in DB; "Load defaults" button seeds Kashier/Bosta/Instapay for Money In
- [x] **Cashflow DB-backed categories** — Cashflow page fetches `/categories` instead of hardcoded list; free-text fallback when no categories configured
- [x] **Multi-tenant cashflow fix** — Migration 0010 replaced global `UNIQUE(name)` on `cashflow_months` with per-brand `UNIQUE(name, brand_id)`; added `res.ok` checks + error display in Cashflow.jsx submit/delete
- [x] **DB indexes** — Migration 0011 adds 7 indexes on `brand_id` columns + `bosta_reports.uploaded_at` + `cashflow_entries.created_at`
- [x] **Admin Overview Portal** — `/admin` route (no sidebar), `GET /admin/overview` endpoint, cross-brand KPI table, "View Overview →" from brand picker
- [x] **Bosta fulfillment API swap** — `/stock-value` now uses single `GET /api/v2/products/fulfillment/list-products` call (no N+1 per-product detail calls)
- [x] **Stock Value — Consumer & Purchase Price** — Migration 0012 `stock_purchase_prices` table; Consumer Price from Bosta, editable Purchase Price (auto-saved), Consumer Value + Purchase Value columns + summary cards
- [x] **Bosta daily automation** — Playwright + Gmail IMAP pipeline fully working. Login → Successful tab (Arabic: تم بنجاح) → Export (تحميل) → email → IMAP download → sort/filter → upload. launchd job at 7 AM. Settings page has bosta_email + bosta_password + bosta_email_password (Gmail App Password) per brand.
- [x] **P&L enhancements** — Unknown Product inline naming (POST /products); Ads column auto-computed as (price×5%)+CPP; Cost breakdown popup (click, global per SKU via migration 0013 `sku_cost_items`); fill-drag copies breakdown across rows
- [x] **Bosta Orders UX overhaul** — Cost cell always opens popup (no direct edit); "Automate Export" SSE button; DateRangeButton removed; StatBar moved below P&L (Orders/Revenue/Expense/Net Profit/Profit%); fill-drag on cost cells
- [x] **main.py split into app/routers/** — auth, cashflow, dashboard, products, settings, bosta routers; main.py reduced to 37 lines
- [x] **BostaOrders component split** — `utils/evalFormula.js`, `components/pl/{PlEditCell,RefTd,CostPopup,PlTableRow}.jsx`, `components/ReportHistory.jsx`; BostaOrders.jsx ~280 lines (state + layout only)

## In Progress

_(none)_

## Pending / Backlog

- [ ] **Bosta API integration** — Fetch orders directly via Bosta API token instead of Excel upload
  - Blocker: need `POST /api/v2/deliveries/search` endpoint details
  - The analytics endpoint `GET /api/v2/deliveries/analytics/total-deliveries` only gives summary counts
  - Webhook docs found but are push-only

- [ ] **Password change** — Allow users to change their own password
- [ ] **Export cashflow** — Download cashflow table as CSV/Excel
