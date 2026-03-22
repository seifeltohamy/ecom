# Feature Checklist
<!-- AGENT INSTRUCTIONS: Move completed features to Done with date. Keep Done list as scannable titles only. -->

## Done

- [x] Vite + React migration (CDN → Vite + React Router v6)
- [x] Authentication (JWT, protected routes, admin/viewer roles)
- [x] User management — create, rename, delete, name field in sidebar
- [x] Bosta Excel upload — SKU/qty/price from Description column, date filter
- [x] Bosta report history — saved to DB, listed, viewable
- [x] Products CRUD — add/update/delete SKUs with names
- [x] Cashflow months — create, switch
- [x] Cashflow entries CRUD — add, edit, delete (with confirm)
- [x] Cashflow monthly summary cards — Total In / Out / Net
- [x] Cashflow search/filter — by category/notes; running balance preserved
- [x] Analytics — monthly totals + money-out distribution chart
- [x] Dashboard (Home) — KPI cards, last report, top SKU, quick links
- [x] Mobile responsive layout — hamburger topbar, sidebar drawer
- [x] Loading states — spinner bar on all pages
- [x] ProductsSold page — `/products-sold/{month}`, inline-editable P&L table
- [x] StockValue page — live Bosta inventory, total stock value
- [x] Settings page — Bosta API key per brand
- [x] Multi-tenant brands — brands table, JWT-based isolation, BrandPicker
- [x] EcomHQ rebrand (from "Zen Finance"); two-column login page
- [x] Auth race fix — JWT decoded synchronously in login()
- [x] P&L Excel-style formulas — click-to-reference, fill-drag, autosave, DB-persisted
- [x] Categories page — `/categories`; Money In / Money Out per brand; Load defaults
- [x] Cashflow DB-backed categories — fetched from DB, free-text fallback
- [x] Multi-tenant cashflow fix — migration 0010 (per-brand unique months)
- [x] DB indexes — migration 0011 (7 indexes on brand_id columns)
- [x] Admin Overview Portal — `/admin`, cross-brand KPI table
- [x] Bosta fulfillment API swap — single paginated call
- [x] Stock Value — Consumer & Purchase Price columns; summary cards
- [x] Bosta daily automation — Playwright + Gmail IMAP export pipeline; launchd
- [x] P&L enhancements — Unknown Product inline naming; Ads column; Cost breakdown popup; fill-drag
- [x] Bosta Orders UX overhaul — cost popup always; Automate Export SSE; StatBar below table
- [x] main.py split into app/routers/ (auth, cashflow, dashboard, products, settings, bosta, sms)
- [x] Analytics enhancements — Net card; Money In by Source; Bosta P&L; Stock potential; Trend table
- [x] Stock Value — units_sold, sell_through%, days_remaining per row; GMROI + Slow Mover cards
- [x] Dashboard trend + Bosta summary endpoints
- [x] Read Only user permission — migration 0015; require_writable dep; toggle UI
- [x] Settings viewer access — GET /settings relaxed; /settings in PERMISSIONED_PAGES
- [x] Role label "User" (was "Viewer") — UI only
- [x] Admin users management in Admin Portal — GET/PUT/DELETE /admin/admins/{id}
- [x] Analytics bar chart fixes — proportional distribution; nowrap; duplicate title removed
- [x] BI Assistant — Gemini 2.5 Flash; chat-style; markdown; live stock snapshot; permission-controlled
- [x] Settings brand badge + fetch error fix
- [x] Stock alert configurable — per-brand times + threshold; hourly APScheduler job
- [x] Bank SMS → Cashflow suggestions — iOS Shortcut; 3 CIB formats; migration 0017; accept/dismiss UI
- [x] Bosta payout email → Cashflow suggestions — Gmail IMAP; migration 0018; type/category; manual trigger
- [x] Meta Ads integration — FB popup OAuth; ad account picker; Settings/Home/Analytics/BI/Bosta auto-fill
- [x] Stock daily inventory email — morning always sends full inventory; evening sends low-stock only
- [x] Bosta daily IMAP fix — select [Gmail]/All Mail instead of inbox
- [x] To Do Kanban board — columns = people, tasks with deadline/notes/activity tag, filter by activity, manage activities panel (migration 0019)
- [x] To Do done checkbox — circle toggle, done tasks collapse per column (migration 0020)
- [x] To Do drag-and-drop — drag tasks between person columns; Activity View with CSS grid per activity section; drag between cells to reassign
- [x] To Do unassigned tasks — "Unassigned" column in Activity View; create tasks without a person; drag to assign (migration 0021)
- [x] To Do drag sort fix — sort_order=0 bug fixed; POST /todo/reorder endpoint; optimistic UI (instant drag response)

## In Progress

*(none)*

## Pending / Backlog

- [ ] **Bosta API integration** — direct orders fetch via API (blocker: need POST /api/v2/deliveries/search details)
- [ ] **Password change** — users change their own password
- [ ] **Export cashflow** — download as CSV/Excel
- [ ] **P3–P7 scaling** — see `.claude/planning/scaling.md` (N+1 queries, brand-switch state clear, race condition)
