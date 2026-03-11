# Code Patterns
<!-- AGENT INSTRUCTIONS: Update this file when new patterns are established or existing ones change.
     Every pattern must include the source file where the canonical implementation lives. -->

---

## Backend Patterns (Python / FastAPI)

### DB Session — Context Manager
**Always `with get_db() as db:`. Never call `db.close()` manually.**
```python
# CORRECT
with get_db() as db:
    user = db.query(models.User).filter(models.User.email == email).first()
    db.add(new_entry)
    db.commit()

# WRONG — never do this
db = SessionLocal()
try:
    ...
finally:
    db.close()
```
`get_db()` is a `@contextmanager` in `app/deps.py` that handles `db.close()` in its `finally` block.
You must still call `db.commit()` explicitly — it does NOT auto-commit.
Source: `app/deps.py`

---

### Auth Dependencies
```python
# Any authenticated user (viewer or admin):
def my_endpoint(current_user: models.User = Depends(get_current_user)):

# Admin only:
def admin_endpoint(current_user: models.User = Depends(require_admin)):
```
Source: `app/deps.py`

---

### Router Organisation — app/routers/ package
All route handlers live in `app/routers/`, not `main.py`. `main.py` only does app creation + `include_router` calls.

| Router file | Route prefixes |
|-------------|----------------|
| `app/routers/auth.py` | `/auth/*`, `/brands/*`, `/users/*` |
| `app/routers/cashflow.py` | `/cashflow/*`, `/categories/*` |
| `app/routers/dashboard.py` | `/dashboard/*`, `/admin/*` |
| `app/routers/products.py` | `/products`, `/products-sold/*` |
| `app/routers/settings.py` | `/settings`, `/stock-value/*` |
| `app/routers/bosta.py` | `/upload`, `/debug-upload`, `/reports/*`, `/automation/*`, `/sku-cost-items/*` |

`bosta.py` also owns `pending_exports` dict and the `sys.path.insert(automation)` call.

Inline Pydantic models (specific to one router) are defined at the top of the relevant router file. Shared cross-router schemas belong in `app/schemas.py`.

---

### Pydantic Schemas — In schemas.py or router file
Shared request/response shapes go in `app/schemas.py`. Route-specific models can be defined inline at the top of the router file.
```python
# Shared (app/schemas.py):
class UserNameUpdate(BaseModel):
    name: str

# Route-specific (app/routers/bosta.py):
class CostItemsBody(BaseModel):
    items: list[CostItemIn]
```
Source: `app/schemas.py`, `app/routers/`

---

### Upsert Pattern (SQLAlchemy)
```python
existing = db.query(models.Product).filter(models.Product.sku == sku).first()
if existing:
    existing.name = name
else:
    db.add(models.Product(sku=sku, name=name))
db.commit()
```
Source: `app/routers/products.py` → `POST /products`

---

### Bosta Excel Parsing — Column Name Rule
**Use exact string match. No fuzzy matching, no `.lower()` contains.**
```python
# CORRECT — exact match
headers = [str(cell.value) for cell in ws[1]]
if "Delivered at" not in headers:
    raise HTTPException(400, "Missing 'Delivered at' column")
idx = headers.index("Delivered at")

# WRONG — "Expected Delivery Date" also contains "delivery" → false positive
idx = next(i for i, h in enumerate(headers) if "delivery" in h.lower())
```
Date parse chain (try in order):
```python
for fmt in ["%m-%d-%Y, %H:%M:%S", "%m-%d-%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
    try:
        return datetime.strptime(val, fmt)
    except ValueError:
        continue
```
SKU regex: `r"BostaSKU:(BO-\d+)\s*-\s*quantity:(\d+)\s*-\s*itemPrice:([\d.]+)"`
Source: `app/routers/bosta.py` → `parse_description_text()`, `POST /upload`

---

### Bosta API Calls (httpx)
```python
import httpx

async with httpx.AsyncClient(follow_redirects=True) as client:
    resp = await client.get(
        "http://app.bosta.co/api/v2/products/list",  # HTTP not HTTPS
        headers={"Authorization": api_key}
    )
```
API key retrieved from DB:
```python
setting = db.query(models.AppSettings).filter_by(key="bosta_api_key").first()
api_key = setting.value if setting else None
```
Source: `app/routers/settings.py` → `GET /stock-value`

---

### Adding a New DB Table
1. Add model class to `app/models.py`
2. Create migration: `alembic/versions/000N_description.py`
3. Update `.claude/DB_schema.md` — add table definition and migration row
4. Run: `python -m alembic upgrade head`

---

## Frontend Patterns (React / Vite)

### API Calls — Always authFetch
**Never use raw `fetch()` for API calls. Always use `authFetch()` from `utils/auth.js`.**
```js
import { authFetch } from '../utils/auth.js';

// CORRECT
const res = await authFetch('/cashflow/months');
if (!res.ok) { /* handle error */ }
const data = await res.json();

// WRONG — missing auth header, will get 401
const res = await fetch('/cashflow/months');
```
`authFetch` injects `Authorization: Bearer <token>` automatically.
Source: `frontend/src/utils/auth.js`

---

### Page Component Skeleton
Every page follows this structure:
```jsx
import { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth.js';
import { fmt, fmtN } from '../utils/format.js';
import { S } from '../styles.js';
import Alert from '../components/Alert.jsx';
import Card, { CardTitle } from '../components/Card.jsx';

export default function MyPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    authFetch('/my-endpoint')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load.'); setLoading(false); });
  }, []);

  return (
    <div>
      {loading && <Alert type="loading">Loading…</Alert>}
      {error   && <Alert type="error">{error}</Alert>}
      {!loading && data && (
        <Card>
          <CardTitle>Section Title</CardTitle>
          {/* content */}
        </Card>
      )}
    </div>
  );
}
```
Source: `frontend/src/pages/Home.jsx`, `StockValue.jsx`, `ProductsSold.jsx`

---

### Adding a New Page — 5-Step Checklist
All 5 steps are required. Missing any one will break routing or the header title.

1. Create `frontend/src/pages/MyPage.jsx`
2. Import in `frontend/src/App.jsx`: `import MyPage from './pages/MyPage.jsx'`
3. Add to `pageMeta` object in `App.jsx`:
   ```js
   '/my-page': { title: 'Page Title', subtitle: 'Subtitle text' }
   ```
4. Add `<Route>` inside the Layout route group in `App.jsx`:
   ```jsx
   <Route path="my-page" element={<MyPage />} />
   ```
5. Add `<NavLink to="/my-page" ...>` in the sidebar nav in `App.jsx`

If admin-only: wrap NavLink in `{userRole === 'admin' && (...)}`.
Source: `frontend/src/App.jsx`

---

### Design Tokens — S Object
Import `S` from `styles.js` for all layout primitives. Never hardcode equivalent values.
```jsx
import { S } from '../styles.js';

<div style={S.card}>                              // surface card
<div style={S.header}>                            // flex row, space-between
<h1 style={S.h1}>                                 // page title
<p style={S.sub}>                                 // subtitle text
<div style={S.cardTitle}>                         // section header (uppercase, 0.7rem)
<button style={{...S.btnBase, ...S.btnPrimary}}>  // orange action button
<button style={{...S.btnBase, ...S.btnOutline}}>  // ghost button
<button style={{...S.btnBase, ...S.btnDanger}}>   // destructive button
S.navItem(isActive)                               // nav link style (function → object)
```
Source: `frontend/src/styles.js`

---

### CSS Variables — Always Use These, Never Hardcode
```css
var(--bg)        /* #0c0a09  — page background */
var(--surface)   /* #151312  — card background */
var(--surface2)  /* #1b1917  — input background */
var(--border)    /* #272522  — card borders */
var(--border2)   /* #3a3733  — input borders */
var(--text)      /* #f5f5f4  — primary text */
var(--muted)     /* #a8a29e  — secondary text, labels */
var(--accent)    /* #f97316  — orange, primary actions */
var(--danger)    /* #ef4444  — error, destructive */
var(--success)   /* #22c55e  — success state */
var(--radius)    /* 12px */
var(--radius-sm) /* 8px */
```
Source: `frontend/src/index.css`

---

### Number Formatting — Always Use Helpers
```js
import { fmt, fmtN } from '../utils/format.js';

fmt(1234.5)   // → "1,234.50"  (currency, 2 decimal places, en-EG locale)
fmtN(1234)    // → "1,234"     (integer count, no decimals)
```
Never use `.toFixed()` or inline `toLocaleString()`.
Source: `frontend/src/utils/format.js`

---

### Auth State — useAuth Hook
```jsx
import { useAuth } from '../context/AuthContext.jsx';

const { token, userRole, currentUserEmail, currentUserName, login, logout, updateName } = useAuth();

// Guard admin-only UI:
{userRole === 'admin' && <button>Admin Action</button>}
```
Never read `localStorage` directly. Use `getToken()` from `utils/auth.js` or `useAuth()`.
Source: `frontend/src/context/AuthContext.jsx`

---

### Category Lists — Always Import from constants.js
```js
import { moneyInCategories, moneyOutCategories } from '../utils/constants.js';

<select>
  {moneyInCategories.map(c => <option key={c}>{c}</option>)}
</select>
```
Never hardcode category names inline in component files.
Source: `frontend/src/utils/constants.js`

---

### Alert Component — Three Types
```jsx
import Alert from '../components/Alert.jsx';

<Alert type="loading">Fetching data…</Alert>    // spinner
<Alert type="error">Something went wrong.</Alert>
<Alert type="success">Saved successfully.</Alert>
```

---

### Inline Editing Pattern (table cells)
For editable table cells: click to activate input, `onBlur` saves, `Enter` saves, `Escape` cancels.
Only call API if value actually changed.
Source: `frontend/src/pages/ProductsSold.jsx` → `EditCell` component

---

### File Size — Split into Components When a Page Gets Large
When a page or component file exceeds ~400 lines, extract sub-components into separate files.

**Rule:** Page files (`pages/`) own state + layout only. Pure UI logic lives in `components/`.

**Where to put extracted components:**
- Generic reusable UI → `frontend/src/components/`
- Feature-specific primitives → `frontend/src/components/<feature>/` (e.g. `components/pl/`)
- Pure utility functions → `frontend/src/utils/`

**BostaOrders split (reference implementation):**
```
utils/evalFormula.js              — formula evaluator (pure fn)
components/pl/PlEditCell.jsx      — editable cell with formula + fill handle
components/pl/RefTd.jsx           — formula-mode reference cell
components/pl/CostPopup.jsx       — cost breakdown modal
components/pl/PlTableRow.jsx      — single P&L <tr> with all cells
components/ReportHistory.jsx      — Bosta report history card
pages/BostaOrders.jsx             — state + layout (~280 lines)
```

**Anti-pattern:** Defining helper components (PlEditCell, CostPopup, etc.) as local functions inside the page file — they become invisible to search, can't be tested or reused, and bloat the file.

---

### Vite Proxy — Every New API Route Must Be Registered
**Every new backend route prefix must be added to `frontend/vite.config.js` or requests silently return HTML (the SPA), causing `!res.ok` failures.**
```js
'/sku-cost-items': { target: 'http://localhost:8080', changeOrigin: true },
'/automation':     { target: 'http://localhost:8080', changeOrigin: true },
```
Add `bypass: ...` only for routes that are also browser-navigable page paths (e.g. `/settings`, `/admin`).
Source: `frontend/vite.config.js`

---

## Anti-Patterns Reference

| Anti-pattern | Correct alternative |
|---|---|
| `fetch('/api/...')` | `authFetch('/api/...')` |
| `db.close()` manually | `with get_db() as db:` |
| `.toFixed(2)` inline | `fmt(value)` |
| `.toLocaleString()` inline | `fmtN(value)` |
| Hardcoded `#f97316` | `var(--accent)` |
| `style={{ background: '#151312' }}` | `style={S.card}` or `var(--surface)` |
| `if "delivery" in header.lower()` | `if header == "Delivered at"` |
| `https://app.bosta.co` | `http://app.bosta.co` with `follow_redirects=True` |
| `useContext(AuthContext)` directly | `useAuth()` |
| Inline category array | `moneyInCategories` / `moneyOutCategories` from constants.js |
| New page without `pageMeta` entry | Always add `pageMeta` entry in `App.jsx` |
| Route handlers in `main.py` | Define in `app/routers/<name>.py` |
| New API route not in vite.config.js proxy | Always add prefix to `frontend/vite.config.js` |
