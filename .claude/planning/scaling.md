# Plan: Scale Safely — Isolation, Performance & Reliability

## Context

The app now has multiple brands in production. A full audit revealed issues that will cause real problems as brand count and data grow: a security gap in user management (admin can modify any brand's users), performance traps (N+1 queries, no connection pool config, no pagination), and frontend state that can leak between brand switches. This plan fixes them in priority order.

---

## Priority 1 — Security (fix before adding more brands)

### Brand isolation in user management (`main.py`)

**Problem:** `PUT /users/{user_id}` and `DELETE /users/{user_id}` query by `user_id` only — no `brand_id` filter. An admin logged into Brand A can modify or delete users belonging to Brand B.

**Fix:** Add `brand_id: int = Depends(get_brand_id)` to both endpoints and add `.filter(models.User.brand_id == brand_id)` to the query.

```python
# main.py — PUT /users/{user_id}
user = db.query(models.User).filter(
    models.User.id == user_id,
    models.User.brand_id == brand_id,  # ADD THIS
).first()

# main.py — DELETE /users/{user_id}
user = db.query(models.User).filter(
    models.User.id == user_id,
    models.User.brand_id == brand_id,  # ADD THIS
).first()
```

**Files:** `main.py` lines ~877 and ~888

---

## Priority 2 — DB Connection Pool (`app/db.py`)

**Problem:** SQLAlchemy defaults to pool_size=5, max_overflow=10, no pool_recycle. Under concurrent load (multiple brands active simultaneously), connections queue or go stale after Railway's idle timeout (~30 min).

**Fix:**

```python
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=600,   # recycle every 10 min (well under Railway's ~30 min idle timeout)
)
```

**File:** `app/db.py` line ~9

---

## Priority 3 — Fix N+1 in `/admin/overview` (`main.py`)

**Problem:** For N brands, the endpoint executes 6N+ DB round-trips (users_count, products_count, cashflow_months_count, cashflow_entries_total, current-month rows loop, bosta_reports_count, last_report). With 10 brands = 60+ queries. Gets worse linearly.

**Fix:** Replace per-brand scalar queries with bulk GROUP BY aggregations fetched once:

```python
from sqlalchemy import func

# One query each, grouped by brand_id:
user_counts    = dict(db.query(models.User.brand_id, func.count()).group_by(models.User.brand_id).all())
product_counts = dict(db.query(models.Product.brand_id, func.count()).group_by(models.Product.brand_id).all())
report_counts  = dict(db.query(models.BostaReport.brand_id, func.count()).group_by(models.BostaReport.brand_id).all())

# cashflow entries: join months → entries, group by brand
entry_counts = dict(
    db.query(models.CashflowMonth.brand_id, func.count(models.CashflowEntry.id))
    .join(models.CashflowEntry, models.CashflowEntry.month_id == models.CashflowMonth.id)
    .group_by(models.CashflowMonth.brand_id).all()
)

# Current month in/out: SUM grouped by brand_id and type
cur_month_rows = (
    db.query(
        models.CashflowMonth.brand_id,
        models.CashflowEntry.type,
        func.sum(models.CashflowEntry.amount).label("total"),
    )
    .join(models.CashflowEntry, models.CashflowEntry.month_id == models.CashflowMonth.id)
    .filter(models.CashflowMonth.name == current_month_name)
    .group_by(models.CashflowMonth.brand_id, models.CashflowEntry.type)
    .all()
)

# Last report per brand: subquery with row_number or max(uploaded_at)
last_reports = dict(
    db.query(models.BostaReport.brand_id, func.max(models.BostaReport.uploaded_at))
    .group_by(models.BostaReport.brand_id).all()
)

# Then loop brands to assemble response — zero DB queries in the loop
```

Total: ~6 queries regardless of brand count (was 6N).

**File:** `main.py` lines ~168–238

---

## Priority 4 — Fix N+1 in P&L save (`main.py`)

**Problem:** `PUT /reports/{report_id}/pl` loops over payload.items and does one SELECT per SKU (100 SKUs = 100 queries).

**Fix:** Fetch all existing rows for the report once, build a dict, upsert from dict:

```python
existing = {
    row.sku: row
    for row in db.query(models.BostaReportPl).filter(
        models.BostaReportPl.report_id == report_id
    ).all()
}
for item in payload.items:
    row = existing.get(item.sku) or models.BostaReportPl(report_id=report_id, sku=item.sku)
    row.price              = item.price
    row.cost               = item.cost
    row.extra_cost         = item.extra_cost
    row.cost_formula       = item.cost_formula
    row.extra_cost_formula = item.extra_cost_formula
    if item.sku not in existing:
        db.add(row)
db.commit()
```

**File:** `main.py` lines ~771–787

---

## Priority 5 — Dashboard summary SQL aggregation (`main.py`)

**Problem:** `GET /dashboard/summary` fetches all cashflow entries for all YTD months and sums them in Python. With 12 months × 200 entries = 2400 rows loaded into memory.

**Fix:** Replace Python loop with SQL SUM + CASE:

```python
from sqlalchemy import func, case

totals = db.query(
    func.sum(case((models.CashflowEntry.type == "in",  models.CashflowEntry.amount), else_=0)).label("total_in"),
    func.sum(case((models.CashflowEntry.type == "out", models.CashflowEntry.amount), else_=0)).label("total_out"),
).filter(models.CashflowEntry.month_id.in_(ytd_ids)).one()
total_in_ytd  = totals.total_in  or 0
total_out_ytd = totals.total_out or 0
```

**File:** `main.py` lines ~821–828

---

## Priority 6 — Frontend: clear page state on brand switch

**Problem:** When admin switches brands, page-level state (months, rows, activeMonth) persists from the previous brand for 1 frame before the new brand's useEffect fires. Brand A data is briefly visible under Brand B.

**Fix:** Each data-fetching page reads `brandId` from `useAuth()` and clears its local state in a `useEffect` keyed to `brandId`:

```jsx
// In Cashflow.jsx, Analytics.jsx, Home.jsx, ProductsSold.jsx, BostaOrders.jsx:
const { brandId } = useAuth();

useEffect(() => {
  setMonths([]);
  setRows([]);       // or setSummary(null), setReport(null), etc.
  setActiveMonth('');
}, [brandId]);
```

Page immediately shows loading state (not stale Brand A data) on brand switch.

**Files:** `frontend/src/pages/Cashflow.jsx`, `Analytics.jsx`, `Home.jsx`, `ProductsSold.jsx`, `BostaOrders.jsx`

---

## Priority 7 — Race condition: upsert in products-sold (`main.py`)

**Problem:** `PUT /products-sold/{month}/{sku}` does check-then-create. Two simultaneous requests for the same SKU both see `None`, both INSERT → unique constraint violation → 500.

**Fix:** Catch `IntegrityError` and retry fetch:

```python
from sqlalchemy.exc import IntegrityError

try:
    if not existing_row:
        db.add(new_row)
    db.commit()
except IntegrityError:
    db.rollback()
    with get_db() as db2:
        row = db2.query(models.ProductsSoldManual).filter(...).first()
        # apply payload fields and commit
```

**File:** `main.py` lines ~985–997

---

## Files to Change

| File | Change |
|------|--------|
| `main.py` | P1 user isolation, P3 overview N+1, P4 PL save N+1, P5 dashboard agg, P7 race condition |
| `app/db.py` | P2 connection pool |
| `frontend/src/pages/Cashflow.jsx` | P6 brand switch state clear |
| `frontend/src/pages/Analytics.jsx` | P6 |
| `frontend/src/pages/Home.jsx` | P6 |
| `frontend/src/pages/ProductsSold.jsx` | P6 |
| `frontend/src/pages/BostaOrders.jsx` | P6 |

No migrations needed — all changes are code-only.

---

## Verification

1. **Isolation:** Admin on Brand A calls `PUT /users/{id_of_brand_b_user}` → 404 (not found)
2. **Pool:** 20 concurrent requests → no "QueuePool limit" errors in backend logs
3. **Overview speed:** `/admin/overview` with 3 brands → ≤6 queries in logs (not 18+)
4. **PL save:** Save report with 50 SKUs → ≤2 queries in logs (not 50)
5. **Brand switch:** Switch Zen → Car Play → Cashflow page shows loading spinner immediately (not Zen rows)

---

## Deferred (add when needed)

- **Pagination** on `/products`, `/reports`, `/users` — add when any brand hits 500+ items
- **Table virtualization** (`react-window`) — add when pages routinely exceed 200 rows
- **Token refresh / auto-logout** — not a scaling blocker today
