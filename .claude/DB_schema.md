# Database Schema
<!-- AGENT INSTRUCTIONS: Update this file whenever you add/modify a model or run a migration.
     Update the Migrations table too. Source of truth: app/models.py + alembic/versions/ -->

## Database
- **Engine:** PostgreSQL (via SQLAlchemy + Alembic)
- **Connection:** `DATABASE_URL` env var (in `.env`)
- **Session pattern:** `with get_db() as db:` (context manager in app/deps.py)

---

## Tables

### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, index |
| email | String(255) | unique, index, not null |
| password_hash | String(255) | not null |
| role | Enum(UserRole) | not null, default=viewer |
| name | String(128) | nullable |
| created_at | DateTime | not null, default=utcnow |

**Enum UserRole:** `admin`, `viewer`

---

### `products`
| Column | Type | Constraints |
|--------|------|-------------|
| sku | String(64) | PK |
| name | String(255) | not null |

---

### `cashflow_months`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, index |
| name | String(64) | unique, not null (e.g. "Mar 2026") |
| created_at | DateTime | not null, default=utcnow |

**Relationship:** `entries` → many `CashflowEntry` (cascade delete)

---

### `cashflow_entries`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, index |
| month_id | Integer | FK → cashflow_months.id (CASCADE), index |
| date | String(32) | not null (display date e.g. "1/3") |
| type | String(8) | not null ("in" or "out") |
| amount | Float | not null |
| category | String(128) | not null |
| notes | Text | nullable |
| created_at | DateTime | not null, default=utcnow |

---

### `deleted_cashflow_entries` (soft-delete audit log)
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK |
| month_name | String(64) | not null |
| date | String(32) | not null |
| type | String(8) | not null |
| amount | Float | not null |
| category | String(128) | not null |
| notes | Text | nullable |
| deleted_at | DateTime | not null, default=utcnow |

**Unique constraint:** `(month_name, id)` — named `uq_deleted_month_id`

---

### `bosta_reports`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, index |
| uploaded_at | DateTime | not null, default=utcnow |
| date_from | String(16) | nullable (YYYY-MM-DD) |
| date_to | String(16) | nullable (YYYY-MM-DD) |
| order_count | Integer | not null, default=0 |
| grand_quantity | Integer | not null, default=0 |
| grand_revenue | Float | not null, default=0.0 |
| rows_json | Text | not null, default="[]" — JSON-encoded rows array |

---

## Migrations

| Revision | File | Description |
|----------|------|-------------|
| 0001_initial | alembic/versions/0001_initial.py | users, products, cashflow_months, cashflow_entries, deleted_cashflow_entries |
| 0002_bosta_reports | alembic/versions/0002_bosta_reports.py | bosta_reports table |
| 0003_user_name | alembic/versions/0003_user_name.py | users.name column |

**Run migrations:**
```bash
python -c "
from dotenv import load_dotenv; load_dotenv()
from alembic.config import Config
from alembic import command
import os
cfg = Config('alembic.ini')
cfg.set_main_option('sqlalchemy.url', os.getenv('DATABASE_URL').replace('%','%%'))
command.upgrade(cfg, 'head')
"
```
