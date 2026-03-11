# Plan: DB Indexes + Admin Overview Portal

## Context

Two problems to solve:

1. **DB performance** — `brand_id` columns on `cashflow_months`, `bosta_reports`, `cashflow_categories`, `products`, and `users` have no index. Every brand-scoped query does a full table scan. As entries grow this will slow down every page. Also `bosta_reports.uploaded_at` is unindexed but sorted on every report list fetch.

2. **Admin portal** — Admin currently sees nothing useful before selecting a brand. We need a cross-brand overview page showing KPIs per brand: cashflow totals, report counts, user counts, etc.

---

## Part 1 — DB Indexes (Migration 0011)

**What's missing** (checked against `app/models.py`):

| Table | Column | Currently indexed? |
|-------|--------|--------------------|
| `cashflow_months` | `brand_id` | No |
| `bosta_reports` | `brand_id` | No |
| `bosta_reports` | `uploaded_at` | No |
| `cashflow_categories` | `brand_id` | No |
| `products` | `brand_id` | No |
| `users` | `brand_id` | No |
| `cashflow_entries` | `created_at` | No |

Already indexed: `cashflow_entries.month_id` ✓, all PKs ✓

**Migration file:** `alembic/versions/0011_add_indexes.py`

```python
def upgrade():
    op.create_index('ix_cashflow_months_brand_id',     'cashflow_months',     ['brand_id'])
    op.create_index('ix_bosta_reports_brand_id',       'bosta_reports',       ['brand_id'])
    op.create_index('ix_bosta_reports_uploaded_at',    'bosta_reports',       ['uploaded_at'])
    op.create_index('ix_cashflow_categories_brand_id', 'cashflow_categories', ['brand_id'])
    op.create_index('ix_products_brand_id',            'products',            ['brand_id'])
    op.create_index('ix_users_brand_id',               'users',               ['brand_id'])
    op.create_index('ix_cashflow_entries_created_at',  'cashflow_entries',    ['created_at'])
```

No model changes needed — indexes don't affect SQLAlchemy ORM queries.

---

## Part 2 — Admin Overview Portal

### Access Pattern

Currently `ProtectedRoute` redirects admin with `brandId === null` to `/select-brand`.
The admin overview lives at `/admin` and must be accessible **without** a brand selected.

**Change to `ProtectedRoute` in `App.jsx`:**
```jsx
function ProtectedRoute() {
  const { token, userRole, brandId } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace />;
  if (userRole === 'admin' && brandId === null && location.pathname !== '/admin')
    return <Navigate to="/select-brand" replace />;
  return <Outlet />;
}
```

Add a **"View Overview"** button on `BrandPicker.jsx` that navigates to `/admin`.

### Backend — `GET /admin/overview`

New endpoint in `main.py`. Requires `require_admin` but **no `get_brand_id`** (admin has no brand selected).

Returns one row per brand:
```json
[
  {
    "brand_id": 1,
    "brand_name": "Zen",
    "users_count": 3,
    "products_count": 15,
    "cashflow_months_count": 1,
    "cashflow_entries_total": 32,
    "current_month_in": 50000.0,
    "current_month_out": 20000.0,
    "current_month_net": 30000.0,
    "bosta_reports_count": 5,
    "last_report_date": "2026-03-10"
  }
]
```

Implementation: single DB session, loop over brands, run aggregations per brand.

### Frontend — `AdminPortal.jsx`

New standalone page (no sidebar), similar layout to `BrandPicker.jsx`.

**UI:**
```
[← Back to brand picker]

  Admin Overview
  Numbers across all brands

  Brand        Users  Products  Entries  This Month Net    Reports  Last Report
  Zen            3      15        32     EGP 30,000          5       Mar 2026     [Select →]
  Car Play       1       0         0          —              0          —         [Select →]
  Shower Lava    0       0         0          —              0          —         [Select →]
```

"Select →" calls `POST /auth/select-brand` → updates JWT → navigates to `/`.

### Route + Nav Changes (`App.jsx`)

- Add `import AdminPortal`
- Add `<Route path="admin" element={<AdminPortal />} />` inside `ProtectedRoute` but **outside** `Layout`
- Add `/admin` to `pageMeta`
- Import `useLocation` for `ProtectedRoute` fix

### Vite Proxy (`vite.config.js`)

```js
'/admin': { target: 'http://localhost:8080', changeOrigin: true, bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : null },
```
Handles both browser navigation to `/admin` (SPA bypass) and API calls to `/admin/overview` (proxied to backend).

---

## Files to Change

| File | Change |
|------|--------|
| `alembic/versions/0011_add_indexes.py` | New migration — 7 indexes |
| `main.py` | Add `GET /admin/overview` endpoint |
| `frontend/src/App.jsx` | `ProtectedRoute` location check, `/admin` route outside Layout, pageMeta entry |
| `frontend/src/pages/AdminPortal.jsx` | New page — cross-brand KPI table |
| `frontend/src/pages/BrandPicker.jsx` | Add "View Overview" button |
| `frontend/vite.config.js` | Add `/admin` proxy with bypass |

---

## Verification

1. Run `alembic upgrade head` → 7 indexes created
2. Log in as admin → land on BrandPicker → see "View Overview" button
3. Click it → `/admin` loads, shows table with all brands and their numbers
4. Click "Select →" on a brand row → JWT updates → land on Home page for that brand
5. Cashflow and reports still work correctly (data isolation unchanged)
6. Log in as viewer → no access to `/admin`
