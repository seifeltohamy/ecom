# Plan: Scale Safely — Isolation, Performance & Reliability

## Status

| Priority | Issue | Status |
|----------|-------|--------|
| P1 | User isolation (brand_id filter on user PUT/DELETE) | ✅ Fixed 2026-03-17 |
| P2 | DB connection pool config (pool_size/max_overflow/recycle) | ✅ Fixed 2026-03-17 |
| P3 | N+1 in `/admin/overview` (6N queries → 6 queries) | ⏳ Pending |
| P4 | N+1 in P&L save (100 SKUs = 100 queries) | ⏳ Pending |
| P5 | Dashboard YTD sum in Python (should be SQL SUM+CASE) | ⏳ Pending |
| P6 | Frontend state leaks on brand switch | ⏳ Pending |
| P7 | Race condition in products-sold upsert | ⏳ Pending |

---

## ✅ P1 — User isolation (`app/routers/auth.py`) — DONE

Added `brand_id = Depends(get_brand_id)` + `.filter(models.User.brand_id == brand_id)` to:
- `PUT /users/{user_id}`
- `PUT /users/{user_id}/pages`
- `PUT /users/{user_id}/readonly`
- `DELETE /users/{user_id}`

Admin on Brand A can no longer modify Brand B users.

---

## ✅ P2 — DB Connection Pool (`app/db.py`) — DONE

```python
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=600,
)
```

---

## ⏳ P3 — Fix N+1 in `/admin/overview` (`app/routers/dashboard.py`)

**Problem:** For N brands → 6N+ DB round-trips.

**Fix:** Replace per-brand scalar queries with bulk GROUP BY aggregations:

```python
from sqlalchemy import func

user_counts    = dict(db.query(models.User.brand_id, func.count()).group_by(models.User.brand_id).all())
product_counts = dict(db.query(models.Product.brand_id, func.count()).group_by(models.Product.brand_id).all())
report_counts  = dict(db.query(models.BostaReport.brand_id, func.count()).group_by(models.BostaReport.brand_id).all())

entry_counts = dict(
    db.query(models.CashflowMonth.brand_id, func.count(models.CashflowEntry.id))
    .join(models.CashflowEntry, models.CashflowEntry.month_id == models.CashflowMonth.id)
    .group_by(models.CashflowMonth.brand_id).all()
)

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

last_reports = dict(
    db.query(models.BostaReport.brand_id, func.max(models.BostaReport.uploaded_at))
    .group_by(models.BostaReport.brand_id).all()
)
# Then loop brands to assemble response — zero DB queries in the loop
```

Total: ~6 queries regardless of brand count (was 6N).

---

## ⏳ P4 — Fix N+1 in P&L save (`app/routers/bosta.py`)

**Problem:** `PUT /reports/{report_id}/pl` does one SELECT per SKU.

**Fix:** Fetch all existing rows once, build dict, upsert:

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

---

## ⏳ P5 — Dashboard summary SQL aggregation (`app/routers/dashboard.py`)

**Problem:** `GET /dashboard/summary` loads all YTD entries into Python memory.

**Fix:**

```python
from sqlalchemy import func, case

totals = db.query(
    func.sum(case((models.CashflowEntry.type == "in",  models.CashflowEntry.amount), else_=0)).label("total_in"),
    func.sum(case((models.CashflowEntry.type == "out", models.CashflowEntry.amount), else_=0)).label("total_out"),
).filter(models.CashflowEntry.month_id.in_(ytd_ids)).one()
total_in_ytd  = totals.total_in  or 0
total_out_ytd = totals.total_out or 0
```

---

## ⏳ P6 — Frontend: clear page state on brand switch

**Problem:** Stale Brand A data visible for 1 frame after switching to Brand B.

**Fix:** In each data-fetching page, clear state when `brandId` changes:

```jsx
const { brandId } = useAuth();
useEffect(() => {
  setMonths([]);
  setRows([]);  // or setSummary(null), etc.
  setActiveMonth('');
}, [brandId]);
```

**Files:** `Cashflow.jsx`, `Analytics.jsx`, `Home.jsx`, `ProductsSold.jsx`, `BostaOrders.jsx`

---

## ⏳ P7 — Race condition: products-sold upsert (`app/routers/products.py`)

**Problem:** `PUT /products-sold/{month}/{sku}` — two simultaneous requests both INSERT → unique constraint violation → 500.

**Fix:**

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
        # apply payload and commit
```

---

## Deferred (add when needed)

- Pagination on `/products`, `/reports`, `/users` — when any brand hits 500+ items
- Table virtualization (`react-window`) — when pages routinely exceed 200 rows
- Token refresh / auto-logout
