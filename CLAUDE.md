# EcomHQ — Claude Code Project Brief

> Auto-loaded at session start. Read this first. For details, see `.claude/` files.

## Mandatory Startup Reads
At the start of every session, you must read all files under `.claude/` plus this `CLAUDE.md` before doing any work.

## What This App Does
Multi-brand e-commerce operations dashboard. Tracks cashflow (money in/out),
Bosta order reports (Excel upload + API), stock inventory, and sales profitability.
Two roles: `admin` (full access, manages brands) and `viewer` (all features except user management).

## Stack

| Layer       | Technology                                        | Port  |
|-------------|---------------------------------------------------|-------|
| Backend     | FastAPI (Python 3.12) — `main.py`                 | 8080  |
| Frontend    | Vite + React 18 + React Router v6 — `frontend/`  | 5173  |
| Database    | PostgreSQL via SQLAlchemy + Alembic               | —     |
| Auth        | JWT HS256 + bcrypt (`app/auth.py`, `app/deps.py`) | —     |
| Deploy      | Railway — Dockerfile + `start_prod.sh`            | $PORT |
| HTTP client | httpx (Bosta API calls)                           | —     |

## How to Run

```bash
# Dev (macOS):
./start.sh
# Backend: python -m uvicorn main:app --reload --port 8080
# Frontend: cd frontend && npm run dev (port 5173, proxies API to :8080)

# Dev (Windows):
start.bat

# Prod:
./start_prod.sh   # runs alembic migrations then uvicorn on $PORT
```

Dev credentials: `admin@zen.com` / `Zen@2026`

## Where to Look for Details

| Topic                  | File                         |
|------------------------|------------------------------|
| Stack + quirks         | `.claude/status.md`          |
| Feature progress       | `.claude/checklist.md`       |
| Session history        | `.claude/session_handoff.md` |
| All API endpoints      | `.claude/API_contract.md`    |
| DB tables + migrations | `.claude/DB_schema.md`       |
| Auth flow + roles      | `.claude/AUTH_plan.md`       |
| Code patterns          | `.claude/patterns.md`        |

## Critical Patterns — Always Follow

```python
# Backend: ALWAYS context manager, NEVER manual db.close()
with get_db() as db:
    result = db.query(models.User).filter(...).first()
    db.add(new_obj)
    db.commit()  # must commit explicitly before leaving the with block
```

```js
// Frontend: ALWAYS authFetch, NEVER raw fetch() for API calls
const res = await authFetch('/cashflow/months');
```

```jsx
// Loading states: ALWAYS show Alert spinner while fetching
{loading && <Alert type="loading">Loading…</Alert>}

// Styling: ALWAYS use S tokens + CSS vars, NEVER hardcode colors/spacing
import { S } from '../styles.js';
<div style={S.card}>...</div>
```

## Anti-Patterns — Never Do These

- **Never** use raw `fetch()` for API calls — use `authFetch()`
- **Never** call `db.close()` manually — `with get_db()` handles it
- **Never** hardcode hex colors — use `var(--accent)`, `var(--danger)` etc.
- **Never** skip adding a route to `pageMeta` in `App.jsx` when adding a page
- **Never** fuzzy-match Bosta Excel column names — match `"Delivered at"` exactly
- **Never** use `https://app.bosta.co` — use `http://` with `follow_redirects=True`
- **Never** let a page file grow beyond ~400 lines — extract sub-components to `components/<feature>/` (see `.claude/patterns.md` → "File Size" section)

## Before Touching X, Read Y

| If touching...              | Read first...                      |
|-----------------------------|------------------------------------|
| Any API endpoint            | `.claude/API_contract.md`          |
| `app/models.py` or Alembic  | `.claude/DB_schema.md`             |
| Auth, roles, or JWT         | `.claude/AUTH_plan.md`             |
| Bosta Excel parsing         | `.claude/status.md` → Known Quirks |
| New page component          | `.claude/patterns.md`              |

## Key File Paths

| File | Purpose |
|------|---------|
| `main.py` | All FastAPI routes |
| `app/models.py` | SQLAlchemy models |
| `app/deps.py` | `get_db`, `get_current_user`, `require_admin`, `require_writable` |
| `app/schemas.py` | Pydantic request/response models |
| `frontend/src/App.jsx` | Router, Layout, ProtectedRoute, `pageMeta` |
| `frontend/src/context/AuthContext.jsx` | Token, role, name state |
| `frontend/src/styles.js` | `S` design tokens |
| `frontend/src/index.css` | CSS variables, responsive classes |
| `frontend/src/utils/auth.js` | `authFetch`, `getToken`, `saveToken`, `clearToken` |
| `frontend/src/utils/format.js` | `fmt()` (currency), `fmtN()` (integer) |
| `frontend/src/utils/evalFormula.js` | P&L formula evaluator |
| `frontend/src/utils/constants.js` | Money in/out category lists |
| `frontend/src/components/pl/` | P&L primitives: PlEditCell, RefTd, CostPopup, PlTableRow |
| `frontend/src/components/ReportHistory.jsx` | Bosta report history card |

## Current State
App fully working. Deployed on Railway at `ecom-production-a643.up.railway.app`.
Last session (2026-03-18): Meta Ads integration complete — FB popup OAuth, ad account picker, Home spend/balance chips, Analytics campaigns table, Bosta auto-fill ads_spent, BI snapshot. Stock daily email fix (morning = full inventory). Bosta IMAP fix (`[Gmail]/All Mail`). All code pushed (b2927a2).
Env vars required in Railway: `GEMINI_API_KEY`, `META_APP_ID`, `META_APP_SECRET`, `VITE_META_APP_ID` (build var).
Facebook App must whitelist `ecom-production-a643.up.railway.app` in App Domains + OAuth redirect URIs.
Pending: password change, cashflow CSV export, iOS Shortcut empty body fix.
