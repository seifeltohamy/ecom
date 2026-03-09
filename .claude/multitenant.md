# Multi-Tenant Brand System — Design & Implementation Plan

## Context

The app currently serves a single business (Zen Finance). The goal is to turn it into a
multi-brand platform where:
- **Admin** can create multiple brands and pick which brand portal to enter after login.
  Admin works inside one brand at a time, with the ability to switch.
- **Viewers** belong to exactly one brand. When they log in they go straight into their brand
  portal — they have zero awareness of other brands.
- All business data (cashflow, products, bosta reports, settings) is scoped per brand.
  No data leaks between brands.

## Architecture

### Multi-tenancy strategy: `brand_id` in JWT (row-level isolation)

```
brands table  (1)
    ↓ brand_id FK on every business table
users          ← viewers have brand_id; admin has brand_id = NULL (superadmin)
products
cashflow_months
bosta_reports
app_settings
products_sold_manual
deleted_cashflow_entries
```

JWT payload:
```json
{ "sub": "user@email.com", "role": "admin|viewer", "brand_id": 1, "brand_name": "Zen" }
```
- **Viewer**: `brand_id` permanently set to their brand.
- **Admin** (brand selected): `brand_id` set to chosen brand.
- **Admin** (no brand selected): `brand_id` = null → `ProtectedRoute` redirects to `/select-brand`.

---

## Database Changes

### New table: `brands`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, autoincrement |
| name | String(128) | unique, not null |
| created_at | DateTime | default=utcnow, not null |

### `brand_id` FK added to:
| Table | Nullable? | Notes |
|-------|-----------|-------|
| users | YES | NULL = admin (superadmin) |
| products | NO | |
| cashflow_months | NO | |
| bosta_reports | NO | |
| app_settings | NO | Also changes PK to (key, brand_id) |
| products_sold_manual | NO | |
| deleted_cashflow_entries | NO | |

### Migration: `alembic/versions/0006_multi_tenant.py`
1. Create `brands` table
2. Insert seed: `INSERT INTO brands (name, created_at) VALUES ('Zen', NOW())`
3. Add nullable `brand_id` to all business tables
4. `UPDATE <table> SET brand_id = 1` (all existing data → Zen brand)
5. Set `brand_id` NOT NULL on all except `users`
6. Set admin users' `brand_id` back to NULL: `UPDATE users SET brand_id = NULL WHERE role = 'admin'`
7. Add FK constraints
8. For `app_settings`: drop PK on `key`, create composite PK `(key, brand_id)`

---

## Backend Changes

### `app/models.py`
- New `Brand` model
- Add `brand_id` FK to: `User`, `Product`, `CashflowMonth`, `BostaReport`, `AppSettings` (composite PK), `ProductsSoldManual`, `DeletedCashflowEntry`

### `app/deps.py`
New `get_brand_id` dependency (decodes JWT, extracts `brand_id`, raises 403 if null):
```python
def get_brand_id(token: str = Depends(oauth2_scheme)) -> int:
    payload = auth.decode_token(token)
    brand_id = payload.get("brand_id")
    if brand_id is None:
        raise HTTPException(403, "No brand selected")
    return int(brand_id)
```

### `app/auth.py`
No changes needed — `create_access_token` accepts any dict.

### `app/schemas.py`
Add: `BrandCreate`, `BrandOut`, `BrandSelect`

### `main.py` — new endpoints
```
GET    /brands               # admin only (no brand required) — list all brands
POST   /brands               # admin only (no brand required) — create brand
DELETE /brands/{id}          # admin only — delete brand (blocks if data exists)
POST   /auth/select-brand    # admin only — issue new JWT with chosen brand_id
POST   /auth/clear-brand     # admin only — issue JWT with brand_id=null (for switching)
```

### `main.py` — modified endpoints
- `POST /auth/login`: include `brand_id` and `brand_name` in JWT
- `GET /auth/me`: return `brand_id` and `brand_name` from JWT
- `POST /auth/register`: require admin auth + assign brand_id from admin's current brand to new viewers
- All business endpoints: add `brand_id: int = Depends(get_brand_id)` and filter queries

---

## Frontend Changes

### `AuthContext.jsx`
Add `brandId` and `brandName` state, populate from `/auth/me` response.
Export both in context.

### `App.jsx`
- `ProtectedRoute`: if admin + `brandId === null` → redirect to `/select-brand`
- Add `/select-brand` route (outside ProtectedRoute, but requires auth)
- Layout sidebar: show brand name badge + "Switch Brand" button (admin only)

### New: `BrandPicker.jsx`
Standalone page (no sidebar layout) shown to admin before entering a brand:
- Lists all brands from `GET /brands`
- Click brand → `POST /auth/select-brand` → receive new token → `login(token)` → navigate to `/`
- Create brand form → `POST /brands` → refreshes list
- No layout wrapper — plain centered full-screen page

---

## Auth Flows

### Admin login
```
POST /auth/login
→ JWT { brand_id: null, brand_name: null }
→ ProtectedRoute: admin + brandId===null → /select-brand
→ Admin picks brand → POST /auth/select-brand { brand_id: 2 }
→ New JWT { brand_id: 2, brand_name: "NewBrand" }
→ login(newToken) → navigate to /
```

### Admin switches brand
```
Click "Switch Brand"
→ POST /auth/clear-brand → JWT { brand_id: null }
→ login(clearToken) → brandId becomes null
→ ProtectedRoute: admin + brandId===null → /select-brand
```

### Viewer login
```
POST /auth/login
→ JWT { brand_id: 1, brand_name: "Zen" }
→ ProtectedRoute: token exists, brandId set → renders app
→ Sees only brand_id=1 data
```

---

## Verification Checklist
1. Admin login → lands on BrandPicker, not Home
2. Admin selects "Zen" → enters app → sidebar shows "Zen" badge
3. Admin creates "NewBrand" → appears in picker → can enter it (empty)
4. Admin adds cashflow entry while in NewBrand → switches to Zen → entry not visible
5. Viewer logs in → goes straight to Home → sees only their brand's data
6. "Switch Brand" button → returns to BrandPicker cleanly
7. Tamper JWT `brand_id` → signature fails → 401
