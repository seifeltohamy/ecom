# Database Schema
<!-- AGENT INSTRUCTIONS: Update this file whenever you add/modify a model or run a migration.
     Update the Migrations table too. Source of truth: app/models.py + alembic/versions/ -->

## Database
- **Engine:** PostgreSQL (via SQLAlchemy + Alembic)
- **Connection:** `DATABASE_URL` env var (in `.env`)
- **Session pattern:** `with get_db() as db:` (context manager in app/deps.py)

---

## Tables

### `brands` *(added migration 0006)*
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, index |
| name | String(128) | unique, not null |
| created_at | DateTime | not null, default=utcnow |

---

### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, index |
| email | String(255) | unique, index, not null |
| password_hash | String(255) | not null |
| role | Enum(UserRole) | not null, default=viewer |
| name | String(128) | nullable |
| brand_id | Integer | FK → brands.id, **nullable** (NULL = admin superuser) |
| allowed_pages | Text | nullable — JSON array of allowed page paths, NULL = unrestricted |
| read_only | Boolean | not null, default=false, server_default='false' *(added 0015)* |
| created_at | DateTime | not null, default=utcnow |

**Enum UserRole:** `admin`, `viewer`
**Note:** Admin users have `brand_id=NULL` in DB. Effective brand_id comes from JWT.

---

### `products`
| Column | Type | Constraints |
|--------|------|-------------|
| sku | String(64) | PK |
| name | String(255) | not null |
| brand_id | Integer | FK → brands.id, not null |

---

### `cashflow_months`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, index |
| name | String(64) | not null (e.g. "Mar 2026") |
| brand_id | Integer | FK → brands.id, not null |
| created_at | DateTime | not null, default=utcnow |

**Note:** `name` is no longer globally unique — unique per brand.
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
| brand_id | Integer | FK → brands.id, not null |
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
| brand_id | Integer | FK → brands.id, not null |
| ads_spent | Float | nullable — saved from P&L ads input |

---

### `bosta_report_pl` *(added migration 0007, extended 0008)*
| Column | Type | Constraints |
|--------|------|-------------|
| report_id | Integer | **composite PK**, FK → bosta_reports.id (CASCADE) |
| sku | String(64) | **composite PK** |
| price | Float | nullable |
| cost | Float | nullable — computed float from formula |
| extra_cost | Float | nullable — computed float from formula |
| cost_formula | Text | nullable — raw formula string e.g. `=price*0.25` |
| extra_cost_formula | Text | nullable — raw formula string |

---

### `cashflow_categories` *(added migration 0009)*
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, index |
| brand_id | Integer | FK → brands.id (CASCADE), not null |
| type | String(8) | not null — `'in'` or `'out'` |
| name | String(128) | not null |
| sort_order | Integer | not null, default=0 |
| created_at | DateTime | not null, default=utcnow |

**Unique constraint:** `(brand_id, type, name)` — named `uq_cat_brand_type_name`

---

### `products_sold_manual`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, index |
| month_id | Integer | FK → cashflow_months.id (CASCADE) |
| sku | String(64) | not null |
| price | Float | nullable |
| new_price | Float | nullable |
| cost | Float | nullable |
| extra_cost | Float | nullable |
| expense | Float | nullable |

**Unique constraint:** `(month_id, sku)` — named `uq_ps_month_sku`

---

### `stock_purchase_prices` *(added migration 0012)*
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, index |
| brand_id | Integer | FK → brands.id, not null, index |
| sku | String(64) | not null |
| purchase_price | Float | not null, default=0 |

**Unique constraint:** `(brand_id, sku)` — named `uq_spp_brand_sku`

---

### `sku_cost_items` *(added migration 0013)*
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, autoincrement |
| brand_id | Integer | FK → brands.id CASCADE, not null, index |
| sku | String(64) | not null |
| name | String(128) | not null |
| amount | Float | not null, default=0 |

**Unique constraint:** `(brand_id, sku, name)` — named `uq_sci_brand_sku_name`
**Indexes:** `ix_sci_brand_id` on brand_id; `ix_sci_brand_sku` on (brand_id, sku)
**Note:** Global per brand/SKU — not per-report. Full replace on save (delete + insert).

---

### `app_settings`
| Column | Type | Constraints |
|--------|------|-------------|
| key | String(64) | **composite PK** with brand_id |
| brand_id | Integer | FK → brands.id, **composite PK** with key |
| value | Text | nullable |

**Note:** PK is `(key, brand_id)` — must filter by both when querying. e.g.:
```python
db.query(models.AppSettings).filter(
    models.AppSettings.key == "bosta_api_key",
    models.AppSettings.brand_id == brand_id,
).first()
```

---

### `sms_suggestions` *(added migration 0017, extended 0018)*
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, autoincrement |
| brand_id | Integer | FK → brands.id CASCADE, not null, index |
| raw_text | Text | nullable |
| amount | Float | not null |
| description | String(256) | nullable |
| ref_number | String(64) | nullable |
| tx_date | DateTime | nullable |
| type | String(8) | not null, default='out' — `'in'` or `'out'` *(added 0018)* |
| category | String(128) | nullable — pre-assigned category e.g. "Bosta" *(added 0018)* |
| status | String(16) | not null, default='pending' — `'pending'`/`'accepted'`/`'dismissed'` |
| created_at | DateTime | not null |

**Unique constraint:** `(brand_id, ref_number)` — named `uq_sms_brand_ref`
**Indexes:** `ix_sms_suggestions_brand_id`, `ix_sms_suggestions_status`
**Note:** SMS suggestions have `type='out'`, `category=NULL`. Bosta payout suggestions have `type='in'`, `category='Bosta'`.

---

## Migrations

| Revision | File | Description |
|----------|------|-------------|
| 0001_initial | alembic/versions/0001_initial.py | users, products, cashflow_months, cashflow_entries, deleted_cashflow_entries |
| 0002_bosta_reports | alembic/versions/0002_bosta_reports.py | bosta_reports table |
| 0003_user_name | alembic/versions/0003_user_name.py | users.name column |
| 0004_products_sold | alembic/versions/0004_products_sold.py | products_sold_manual table |
| 0005_app_settings | alembic/versions/0005_app_settings.py | app_settings key-value table |
| 0006_multi_tenant | alembic/versions/0006_multi_tenant.py | brands table + brand_id on all business tables |
| 0007_report_pl | alembic/versions/0007_report_pl.py | bosta_report_pl table + bosta_reports.ads_spent column |
| 0008_pl_formulas | alembic/versions/0008_pl_formulas.py | cost_formula + extra_cost_formula TEXT on bosta_report_pl |
| 0009_cashflow_categories | alembic/versions/0009_cashflow_categories.py | cashflow_categories table |
| 0010_fix_cashflow_month_unique | alembic/versions/0010_fix_cashflow_month_unique.py | replace global UNIQUE(name) on cashflow_months with UNIQUE(name, brand_id) |
| 0011_add_indexes | alembic/versions/0011_add_indexes.py | 7 indexes: brand_id on cashflow_months/bosta_reports/cashflow_categories/products/users; bosta_reports.uploaded_at; cashflow_entries.created_at |
| 0012_stock_purchase_prices | alembic/versions/0012_stock_purchase_prices.py | stock_purchase_prices table (brand_id, sku, purchase_price); unique on (brand_id, sku) |
| 0013_sku_cost_items | alembic/versions/0013_sku_cost_items.py | sku_cost_items table (brand_id, sku, name, amount); unique on (brand_id, sku, name) |
| 0014_user_permissions | alembic/versions/0014_user_permissions.py | users.allowed_pages TEXT (nullable JSON array of page paths) |
| 0015_user_readonly | alembic/versions/0015_user_readonly.py | users.read_only Boolean NOT NULL DEFAULT false |
| 0016_bi_insights | alembic/versions/0016_bi_insights.py | bi_insights table (brand_id, user_id, question, answer, model, tokens, created_at) |
| 0017_sms_suggestions | alembic/versions/0017_sms_suggestions.py | sms_suggestions table (brand_id, raw_text, amount, description, ref_number, tx_date, status, created_at); unique (brand_id, ref_number) |
| 0018_sms_suggestion_type | alembic/versions/0018_sms_suggestion_type.py | sms_suggestions.type VARCHAR(8) DEFAULT 'out' + sms_suggestions.category VARCHAR(128) nullable |
| 0019_todo_board | alembic/versions/0019_todo_board.py | todo_activities, todo_columns, todo_tasks tables (brand-scoped Kanban board with activity tagging) |
| 0020_todo_task_done | alembic/versions/0020_todo_task_done.py | todo_tasks.done Boolean NOT NULL DEFAULT false |

**Run migrations (from project root with .env set):**
```bash
PYTHONPATH=. .venv/bin/alembic upgrade head
# or on Railway: handled automatically by start_prod.sh
```
