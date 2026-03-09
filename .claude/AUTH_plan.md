# Auth Plan
<!-- AGENT INSTRUCTIONS: Update this file if auth logic, roles, or token handling changes.
     Source of truth: app/auth.py, app/deps.py, main.py auth routes. -->

## Overview
JWT Bearer token auth. Tokens stored in `localStorage` on the frontend.
All protected endpoints require `Authorization: Bearer <token>` header.

---

## Token Flow

1. **Login:** `POST /auth/login` with email+password (FormData/OAuth2)
2. **Backend** verifies password with bcrypt → issues JWT signed with `SECRET_KEY`
3. **Frontend** stores token via `saveToken()` in `src/utils/auth.js` (localStorage)
4. **All API calls** go through `authFetch()` which injects `Authorization: Bearer <token>`
5. **On 401** → frontend clears token, user is redirected to `/login`

---

## JWT Payload
```json
{ "sub": "user@email.com", "role": "admin|viewer", "exp": <timestamp> }
```

- Signed with `SECRET_KEY` env var (HS256)
- Expiry: configured in `app/auth.py` (`ACCESS_TOKEN_EXPIRE_MINUTES`)

---

## Password Hashing
- Library: `passlib[bcrypt]`
- `auth.hash_password(password)` → bcrypt hash
- `auth.verify_password(plain, hashed)` → bool

---

## Roles

| Role | Can Do |
|------|--------|
| `viewer` | All read + write operations (cashflow, products, upload, dashboard) |
| `admin` | Everything viewer can + manage users (GET/PUT/DELETE /users) |

**Note:** Viewers can still add cashflow entries, upload reports, manage products.
Admin-only = user account management only.

---

## FastAPI Dependencies (app/deps.py)

### `get_current_user`
- Decodes JWT from `Authorization` header
- Returns `models.User` object
- Raises 401 if token missing, invalid, or expired
- Used on: all protected non-admin endpoints

### `require_admin`
- Calls `get_current_user` first, then checks `user.role == UserRole.admin`
- Raises 403 if role is viewer
- Used on: `GET /users`, `PUT /users/{id}`, `DELETE /users/{id}`

### `get_db`
- Context manager returning SQLAlchemy `Session`
- Always used as `with get_db() as db:`

---

## Frontend Auth Utilities (frontend/src/utils/auth.js)

| Function | Description |
|----------|-------------|
| `getToken()` | Read token from localStorage |
| `saveToken(t)` | Write token to localStorage |
| `clearToken()` | Remove token from localStorage |
| `authFetch(url, opts)` | fetch() wrapper that injects Bearer header |

## Frontend Auth Context (frontend/src/context/AuthContext.jsx)

| State | Description |
|-------|-------------|
| `token` | Raw JWT string |
| `userRole` | "admin" or "viewer" |
| `currentUserEmail` | Logged-in user's email |
| `currentUserName` | Logged-in user's display name |

| Function | Description |
|----------|-------------|
| `login(token)` | Save token + trigger /auth/me fetch |
| `logout()` | Clear token + reset state |
| `updateName(name)` | PUT /users/me, updates currentUserName |

---

## Security Notes
- `SECRET_KEY` must be set in `.env` — never hardcode
- Registration endpoint (`POST /auth/register`) is not public-facing — only admins use it via the Users page
- Self-delete is blocked server-side in `DELETE /users/{id}`
