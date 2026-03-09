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

## In Progress

_(none)_

## Pending / Backlog

- [ ] **Bosta API integration** — Fetch orders directly via Bosta API token instead of Excel upload
  - Blocker: need `POST /api/v2/deliveries/search` endpoint details
  - The analytics endpoint `GET /api/v2/deliveries/analytics/total-deliveries` only gives summary counts
  - Webhook docs found but are push-only

- [ ] **Password change** — Allow users to change their own password
- [ ] **Export cashflow** — Download cashflow table as CSV/Excel
