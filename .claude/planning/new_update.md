# New Update Plan — Finance Dashboard

## Goals
- Convert the app into a finance dashboard with a left sidebar.
- Rename current upload/report system to **Bosta Orders**.
- Add **Cashflow** page with a table and a modal to add new rows.
- Add **Analytics** page that shows totals and money-out distribution by category.

## UI/Navigation
- Sidebar items:
  - Bosta Orders
  - Cashflow
  - Analytics
  - Products (keep existing)

## Cashflow Table (initial sample rows)
Columns: Date | Money In | Money Out | Reason | Net Flow
Example rows:
- 21/1 | 1335 |  |  | EGP 1,335.00
- 25/1 | 19,903.02 | EGP 3,766 | Ads + Uber | EGP 17,472.02
- 26/1 |  | EGP 12,150 | 16 box bokhour | EGP 5,322.02

## Cashflow Entry Modal
Fields:
- Date
- Type: Money In / Money Out
- Amount
- Category (depends on type)
  - Money In: Kashier, Bosta, Instapay
  - Money Out: Ads, Mabakher, Bokhour, Mabakher + 9 pcs, Uber, Fountains, Foam, Carton Boxes, Charity, Ekrameya, Salary, Seif Gamal, Sama, Refund, Outing, Transportation, Essential Bundles Shopify App, Domain, Shopify
- Reason / Notes

Behavior:
- Net Flow is computed: Money In - Money Out
- Modal validates required fields based on type
- New row is added to the table immediately

## Analytics Page
- Total Money In
- Total Money Out
- Distribution of Money Out per category (summary table or simple bar view)

## Data Storage
- Start with in-memory state in `index.html` (no backend changes yet)
- Optional future: persist cashflow to JSON via FastAPI

---

# Scalability + Auth Update — Phase 1 & 2

## Phase 1 — Postgres Persistence (Done)

### Database
- Provider: **Supabase** (free tier, EU West region)
- Connection: Session Pooler via `aws-1-eu-west-1.pooler.supabase.com:5432`
- ORM: **SQLAlchemy** + **Alembic** for migrations

### New Files
| File | Purpose |
|---|---|
| `app/db.py` | SQLAlchemy engine + session factory |
| `app/models.py` | ORM models |
| `app/schemas.py` | Pydantic request schemas |
| `app/deps.py` | `get_db()` context manager + auth dependencies |
| `app/auth.py` | JWT + bcrypt helpers |
| `alembic.ini` | Alembic config |
| `alembic/env.py` | Alembic env (loads DATABASE_URL from .env) |
| `alembic/versions/0001_initial.py` | Initial migration — creates all tables |
| `.env` | Local secrets (not committed) |
| `.env.example` | Template for env vars |

### DB Tables
| Table | Description |
|---|---|
| `users` | email, password_hash, role (admin/viewer) |
| `products` | sku (PK), name |
| `cashflow_months` | id, name (unique) |
| `cashflow_entries` | id, month_id (FK), date, type, amount, category, notes |
| `deleted_cashflow_entries` | soft-delete archive of removed cashflow rows |

### Migration
- Run: `alembic upgrade head`
- All 21 products migrated from `products.json` into the `products` table
- `products.json` is now unused (kept as backup)

### Updated `requirements.txt`
Added: `sqlalchemy`, `alembic`, `psycopg2-binary`, `python-dotenv`, `python-jose[cryptography]`, `bcrypt`

### `.env` variables
```
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
SECRET_KEY=<32-byte hex secret>
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

---

## Phase 2 — JWT Auth + Login Page (Done)

### Backend
- `POST /auth/register` — create user (email, password, role)
- `POST /auth/login` — returns JWT access token (OAuth2 form)
- `GET /auth/me` — returns current user info
- All other routes now require `Authorization: Bearer <token>`
- Passwords hashed with **bcrypt** (direct, no passlib)
- Tokens signed with **HS256** via `python-jose`

### Default Admin Account
- Email: `admin@zen.com`
- Password: `Zen@2026`

### Frontend (`index.html`)
- Added `LoginPage` component — email/password form, matches app dark theme
- Token stored in `localStorage` under key `zen_token`
- `authFetch()` helper wraps all `fetch()` calls to inject `Authorization` header
- `App` checks for token on load — shows `LoginPage` if not logged in
- **Sign out** button added to sidebar footer (clears token, returns to login)

### Known Issues Fixed
- `alembic.ini` had UTF-8 BOM — removed
- `%` in DATABASE_URL breaks ConfigParser — fixed with `.replace('%', '%%')` in `alembic/env.py`
- `passlib` incompatible with new `bcrypt` — replaced with direct `bcrypt` calls
