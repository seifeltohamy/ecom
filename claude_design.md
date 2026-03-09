Ready for review
Select text to add comments on the plan
Plan: Session Continuity & Cross-Project Best Practices
Context
The user wants to establish a standard system so that:

Every new Claude Code session picks up exactly where the last one left off — no re-explaining context
Code patterns stay consistent across sessions and new projects
The same documentation infrastructure can be replicated for any new project
This project already has a solid .claude/ folder with status.md, checklist.md, session_handoff.md, API_contract.md, DB_schema.md, AUTH_plan.md. Three things are missing that would complete the system:

No CLAUDE.md at project root (the #1 Claude Code feature — auto-loaded every session)
No memory/MEMORY.md (persists across context compression)
No .claude/patterns.md (code conventions + anti-patterns undocumented)
Files to Create
1. /Users/seifeltohamy/Desktop/Zen/sku-app/CLAUDE.md
Auto-loaded by Claude Code on every session start. This is the most important file.

Content:

# Zen Finance — Claude Code Project Brief

> Auto-loaded at session start. Read this first. For details, see `.claude/` files.

## What This App Does
Multi-user finance dashboard for an e-commerce business. Tracks cashflow (money in/out),
Bosta order reports (Excel upload + API), product inventory, and sales profitability.
Two roles: `admin` (full access) and `viewer` (all features except user management).

## Stack

| Layer      | Technology                                        | Port  |
|------------|---------------------------------------------------|-------|
| Backend    | FastAPI (Python 3.12) — `main.py`                 | 8080  |
| Frontend   | Vite + React 18 + React Router v6 — `frontend/`  | 5173  |
| Database   | PostgreSQL via SQLAlchemy + Alembic               | —     |
| Auth       | JWT HS256 + bcrypt (`app/auth.py`, `app/deps.py`) | —     |
| Deploy     | Railway — Dockerfile + `start_prod.sh`            | $PORT |
| HTTP client| httpx (Bosta API calls)                           | —     |

## How to Run

```batch
# Dev (Windows — opens two terminals):
start.bat
# Backend: python -m uvicorn main:app --reload --port 8080
# Frontend: cd frontend && npm run dev (port 5173, proxies API to :8080)

# Prod:
build.bat
python -m uvicorn main:app --port 8080
Dev credentials: admin@zen.com / Zen@2026

Where to Look for Details
Topic	File
Stack + quirks	.claude/status.md
Feature progress	.claude/checklist.md
Session history	.claude/session_handoff.md
All API endpoints	.claude/API_contract.md
DB tables + migrations	.claude/DB_schema.md
Auth flow + roles	.claude/AUTH_plan.md
Code patterns	.claude/patterns.md
Critical Patterns — Always Follow
# Backend: ALWAYS context manager, NEVER manual db.close()
with get_db() as db:
    result = db.query(models.User).filter(...).first()
// Frontend: ALWAYS authFetch, NEVER raw fetch() for API calls
const res = await authFetch('/cashflow/months');
// Loading states: ALWAYS show Alert spinner while fetching
{loading && <Alert type="loading">Loading…</Alert>}

// Styling: ALWAYS use S tokens + CSS vars, NEVER hardcode colors/spacing
import { S } from '../styles.js';
<div style={S.card}>...</div>
Anti-Patterns — Never Do These
Never use raw fetch() for API calls — use authFetch()
Never call db.close() manually — with get_db() handles it
Never hardcode hex colors — use var(--accent), var(--danger) etc.
Never skip adding a route to pageMeta in App.jsx when adding a page
Never fuzzy-match Bosta Excel column names — match "Delivered at" exactly
Never use https://app.bosta.co — use http:// with follow_redirects=True
Before Touching X, Read Y
If touching...	Read first...
Any API endpoint	.claude/API_contract.md
app/models.py or Alembic	.claude/DB_schema.md
Auth, roles, or JWT	.claude/AUTH_plan.md
Bosta Excel parsing	.claude/status.md → Known Quirks
New page component	.claude/patterns.md
Key File Paths
File	Purpose
main.py	All FastAPI routes
app/models.py	SQLAlchemy models
app/deps.py	get_db, get_current_user, require_admin
app/schemas.py	Pydantic request/response models
frontend/src/App.jsx	Router, Layout, ProtectedRoute, pageMeta
frontend/src/context/AuthContext.jsx	Token, role, name state
frontend/src/styles.js	S design tokens
frontend/src/index.css	CSS variables, responsive classes
frontend/src/utils/auth.js	authFetch, getToken, saveToken, clearToken
frontend/src/utils/format.js	fmt() (currency), fmtN() (integer)
frontend/src/utils/constants.js	Money in/out category lists
Current State
App fully working. Deployed on Railway at ecom-production-a643.up.railway.app. Last session: added ProductsSold, StockValue, Settings pages + Railway deployment. Pending: Bosta API direct integration, password change, cashflow CSV export.


---

### 2. `/Users/seifeltohamy/.claude/projects/-Users-seifeltohamy-Desktop-Zen-sku-app/memory/MEMORY.md`
Persistent memory that survives context compression. Only stable facts, no mutable state.

**Content:**
```markdown
# Zen Finance — Persistent Memory

> Stable facts about this project. Survives context compression.
> For mutable state (feature status, session history), see `.claude/` files in the repo.

## Project Identity
- **Name:** Zen Finance
- **Repo:** `https://github.com/seifeltohamy/ecom`
- **Local path:** `/Users/seifeltohamy/Desktop/Zen/sku-app`
- **Production:** `https://ecom-production-a643.up.railway.app` (Railway)
- **Platform:** macOS (use `start.bat` on Windows, run commands manually on Mac)

## Stack (update only if stack changes)
- Backend: FastAPI (Python 3.12), port 8080, entry: `main.py`
- Frontend: Vite + React 18 + React Router v6, port 5173, root: `frontend/`
- DB: PostgreSQL, SQLAlchemy ORM, Alembic migrations in `alembic/versions/`
- Auth: JWT HS256 (`python-jose`), bcrypt (`passlib`)
- Deploy: Docker multi-stage (Node 20 builds frontend, Python 3.12 serves), `start_prod.sh`
- HTTP client: `httpx` for Bosta API calls

## Dev Credentials
- Admin: `admin@zen.com` / `Zen@2026`

## Environment Variables
SECRET_KEY=<random 32+ char string> DATABASE_URL=postgresql://user:pass@host/dbname ACCESS_TOKEN_EXPIRE_MINUTES=<optional, default 480>

`.env` is gitignored. Railway has these set in dashboard.

## Critical Quirks (hard-won knowledge — do not lose these)

### 1. Bosta Excel Column Matching — EXACT MATCH ONLY
- Column header must match `"Delivered at"` exactly (no fuzzy match, no `.lower()`)
- `"Expected Delivery Date"` (index 5) also contains "delivery" — causes false positives
- Date format: `01-13-2026, 17:33:50` (MM-DD-YYYY, HH:MM:SS as string)
- Parse chain: `%m-%d-%Y, %H:%M:%S` → `%m-%d-%Y` → `%Y-%m-%d %H:%M:%S` → `%Y-%m-%d`
- SKU regex on `Description` column: `BostaSKU:(BO-\d+)\s*-\s*quantity:(\d+)\s*-\s*itemPrice:([\d.]+)`

### 2. Bosta API URL — HTTP not HTTPS
- Use `http://app.bosta.co/api/v2/` (not `https://`)
- Set `follow_redirects=True` in httpx
- Auth: static API key stored in `app_settings` table (key = `bosta_api_key`), set via Settings page

### 3. DB Session — Context Manager Pattern
- Always `with get_db() as db:` — commits on success, rolls back on exception
- Never `db.close()` manually
- `get_db()` is a `@contextmanager`, NOT a FastAPI Depends generator
- Must call `db.commit()` explicitly before leaving the `with` block

### 4. Run Commands (macOS)
- `python -m uvicorn main:app --reload --port 8080` (use `-m`, not bare `uvicorn`)
- Frontend: `cd frontend && npm run dev`

## Migration History (stable record)
| Revision | Description |
|----------|-------------|
| 0001_initial | users, products, cashflow_months, cashflow_entries, deleted_cashflow_entries |
| 0002_bosta_reports | bosta_reports table |
| 0003_user_name | users.name column |
| 0004_products_sold | products_sold_manual table |
| 0005_app_settings | app_settings key-value table |

## Key Reference Files in Repo
- Feature status: `.claude/checklist.md`
- Last session: `.claude/session_handoff.md`
- API shapes: `.claude/API_contract.md`
- DB schema: `.claude/DB_schema.md`
- Code patterns: `.claude/patterns.md`
- Stack + quirks: `.claude/status.md`

## Session Discipline Reminder
At end of every session:
1. Prepend new entry to `.claude/session_handoff.md`
2. Move completed items to Done in `.claude/checklist.md`
3. Update `CLAUDE.md` "Current State" line if major milestone reached
4. If DB changed: update `.claude/DB_schema.md` + migration table in this file
5. If API changed: update `.claude/API_contract.md`
3. /Users/seifeltohamy/Desktop/Zen/sku-app/.claude/patterns.md
Code conventions and anti-patterns. Referenced before writing any code.

Content: (full patterns.md covering backend + frontend patterns, anti-patterns table — see plan agent output for exact content)

Key sections:

DB session pattern (correct vs wrong)
Auth dependencies (get_current_user vs require_admin)
Pydantic schemas in app/schemas.py, not inline
Upsert pattern
Bosta Excel parsing rules
Bosta API call pattern (httpx, HTTP, follow_redirects)
authFetch vs raw fetch()
Page component skeleton (useState loading/error pattern)
Adding a new page checklist (5 steps: JSX + import + pageMeta + Route + NavLink)
S design tokens reference
CSS variables reference
fmt() / fmtN() number formatting
useAuth() context hook
moneyInCategories / moneyOutCategories from constants.js
Alert component (loading/error/success)
Inline editing pattern (ProductsSold.jsx)
Anti-patterns table (10 rows)
New-Project Bootstrap Template
For any future project, create these 7 files at project start (before any feature code):

project-root/
├── CLAUDE.md                     <- auto-loaded; concise project brief
└── .claude/
    ├── status.md                 <- stack, commands, known quirks
    ├── checklist.md              <- feature tracking (Done/In Progress/Backlog)
    ├── session_handoff.md        <- per-session summaries (most recent at top)
    ├── patterns.md               <- code conventions + anti-patterns
    ├── API_contract.md           <- all endpoint shapes
    └── DB_schema.md              <- tables + migrations

~/.claude/projects/<encoded-path>/memory/
    └── MEMORY.md                 <- persistent cross-session facts
CLAUDE.md Structure (template)
One-paragraph app description
Stack table (layer / technology / port)
How to run (dev + prod commands, dev credentials)
"Where to look for details" table → links to .claude/ files
Critical patterns (3-5, with code snippets)
Anti-patterns (3-5 bullet points)
"Before touching X, read Y" table
Key file paths table
Current state (one line, updated each session)
Session Discipline Rules
End of every session (mandatory):

Prepend new dated entry to session_handoff.md
Move completed features to Done in checklist.md
Update CLAUDE.md "Current State" line if milestone reached
Update API_contract.md if any endpoint changed
Update DB_schema.md if any model/migration changed
Add new patterns to patterns.md if discovered
Start of every session:

CLAUDE.md is auto-loaded
Read session_handoff.md → last session's state
Read checklist.md → what's pending
Confirm task with user before writing code
Verification
After implementation, verify by:

Close and reopen a Claude Code session in this project
Check that CLAUDE.md content appears in the initial context
Confirm that memory/MEMORY.md is listed in the auto-memory section at session start
Ask Claude "what patterns should I follow when adding a new page?" — it should cite patterns.md correctly without user explaining anything