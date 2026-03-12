# Project Status
<!-- AGENT INSTRUCTIONS: Update this file when the stack changes, new env vars are added,
     or the run/deploy process changes. Keep "Current State" current. -->

## Current State
**Fully working.** Vite + React frontend + FastAPI backend with PostgreSQL.
Recent work: settings view permission fix, admin users management in Admin Portal, analytics distribution bar fixes, Stock Value UI cleanup, and multiple dashboard/stock metrics enhancements.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python) on port **8080** |
| Frontend (dev) | Vite + React 18 + React Router v6 on port **5173** |
| Frontend (prod) | Built to `frontend/dist/`, served by FastAPI StaticFiles |
| Database | PostgreSQL |
| ORM | SQLAlchemy + Alembic |
| Auth | JWT (HS256) + bcrypt |
| Excel parsing | openpyxl |

---

## Key Files

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app bootstrap + router wiring |
| `app/routers/` | Route modules split by domain (auth, cashflow, dashboard, products, settings, bosta) |
| `app/models.py` | SQLAlchemy models |
| `app/schemas.py` | Pydantic request/response schemas |
| `app/auth.py` | JWT + bcrypt helpers |
| `app/deps.py` | FastAPI dependencies (get_db, get_current_user, require_admin) |
| `alembic/versions/` | DB migrations |
| `frontend/src/App.jsx` | Router, Layout, ProtectedRoute |
| `frontend/src/context/AuthContext.jsx` | Token, role, name state |
| `frontend/src/utils/auth.js` | authFetch, token helpers |
| `frontend/src/utils/format.js` | fmt, fmtN number formatters |
| `frontend/src/utils/constants.js` | Money in/out category lists |
| `frontend/src/styles.js` | S design tokens object |
| `frontend/src/index.css` | CSS vars, responsive layout classes |
| `frontend/src/pages/` | 7 page components |
| `frontend/src/components/` | 9 shared components |
| `.env` | SECRET_KEY, DATABASE_URL |
| `start.bat` | Dev launcher (backend + Vite) |
| `build.bat` | Production build (npm run build) |

---

## How to Run

### Development
```batch
start.bat
```
Opens two terminals:
- Backend: `python -m uvicorn main:app --reload --port 8080`
- Frontend: `cd frontend && npm run dev` (port 5173)

API calls proxied: Vite → localhost:8080 (configured in `frontend/vite.config.js`)

### Production
```batch
build.bat
python -m uvicorn main:app --port 8080
```
FastAPI serves `frontend/dist/` via StaticFiles + SPA fallback route.

---

## Environment Variables (.env)
```
SECRET_KEY=<random 32+ char string>
DATABASE_URL=postgresql://user:pass@host/dbname
```

---

## Known Quirks

### Bosta Excel Parsing
- **Column name:** `"Delivered at"` — exact lowercase match required
- **Do NOT** use fuzzy match — `"Expected Delivery Date"` (index 5) also contains "delivery" and caused a bug
- **Date format in Excel:** `01-13-2026, 17:33:50` (MM-DD-YYYY, HH:MM:SS as string)
- Parse attempts (in order): `%m-%d-%Y, %H:%M:%S` → `%m-%d-%Y` → `%Y-%m-%d %H:%M:%S` → `%Y-%m-%d`
- **SKU regex:** `BostaSKU:(BO-\d+)\s*-\s*quantity:(\d+)\s*-\s*itemPrice:([\d.]+)` on `Description` column

### DB Session
- Always use `with get_db() as db:` — context manager handles commit/rollback/close
- Never use `db.close()` manually

### Frontend authFetch
- Always use `authFetch()` from `utils/auth.js` — never raw `fetch()` for API calls
- It injects the Bearer token automatically

### Bosta Products API
- List: `GET /api/v2/products?pageNumber=0&pageSize=100` — paginate until batch < pageSize
- Detail: `GET /api/v2/products/{id}` — returns `productsVariances` with `bostaSku`, `variantQuantity`, `reservedQuantity`
- Auth: `Authorization: <api_key>` — raw key, NO Bearer prefix
- Do NOT use `/products/list` — returns 400 errorCode 16000
- Non-variant products lack `bostaSku` in the list response — must fetch individually to get correct BO-XXXXXX SKU
- `variantQuantity` ≠ Bosta dashboard "Onhand Quantity" (API limitation; `totalOnhand` field returns 0 for all variants)
- Vite proxy routes (`/stock-value`, `/settings`, `/products-sold`) need `bypass` to avoid returning API JSON on browser navigation

### Port 8080
- Use `python -m uvicorn` not bare `uvicorn` to avoid PATH issues on Windows
