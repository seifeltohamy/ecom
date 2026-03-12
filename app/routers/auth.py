import json
from fastapi import APIRouter, Form, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.deps import get_db, get_current_user, require_admin, get_brand_id, oauth2_scheme, require_writable
from app import models, schemas, auth

router = APIRouter()


def _parse_json_list(val):
    """Parse a JSON TEXT column that is a list, or return None if null/invalid."""
    if val is None:
        return None
    try:
        result = json.loads(val)
        return result if isinstance(result, list) else None
    except Exception:
        return None


@router.post("/auth/register", tags=["auth"])
def register(
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form("viewer"),
    name: str = Form(""),
    allowed_pages: str = Form(None),      # JSON string like '["/","/cashflow"]'; viewers only
    read_only: str = Form("false"),       # "true" / "false"
    _admin: models.User = Depends(require_admin),
    brand_id: int = Depends(get_brand_id),
):
    if role not in ("admin", "viewer"):
        raise HTTPException(status_code=400, detail="Role must be admin or viewer")
    with get_db() as db:
        if db.query(models.User).filter(models.User.email == email).first():
            raise HTTPException(status_code=400, detail="Email already registered")
        pages_val = allowed_pages if role == "viewer" else None
        user = models.User(
            email=email,
            password_hash=auth.hash_password(password),
            role=models.UserRole(role),
            name=name.strip() or None,
            brand_id=brand_id if role == "viewer" else None,
            allowed_pages=pages_val,
            read_only=(read_only.lower() == "true"),
        )
        db.add(user)
        db.commit()
    return {"ok": True, "email": email, "role": role}


@router.post("/auth/login", tags=["auth"])
def login(form: OAuth2PasswordRequestForm = Depends()):
    with get_db() as db:
        user = db.query(models.User).filter(models.User.email == form.username).first()
        if not user or not auth.verify_password(form.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        jwt_brand_id = None if user.role == models.UserRole.admin else user.brand_id
        brand_name = None
        if jwt_brand_id is not None:
            brand = db.query(models.Brand).filter(models.Brand.id == jwt_brand_id).first()
            brand_name = brand.name if brand else None
        allowed_pages     = _parse_json_list(user.allowed_pages)
        allowed_brand_ids = _parse_json_list(user.allowed_brand_ids)
        read_only         = bool(user.read_only)
    token = auth.create_access_token({
        "sub": user.email,
        "role": user.role.value,
        "brand_id": jwt_brand_id,
        "brand_name": brand_name,
        "allowed_pages": allowed_pages,
        "allowed_brand_ids": allowed_brand_ids,
        "read_only": read_only,
    })
    return {"access_token": token, "token_type": "bearer", "role": user.role.value, "brand_id": jwt_brand_id}


@router.get("/auth/me", tags=["auth"])
def me(token: str = Depends(oauth2_scheme), current_user: models.User = Depends(get_current_user)):
    payload = auth.decode_token(token)
    return {
        "email": current_user.email,
        "role": current_user.role.value,
        "name": current_user.name or "",
        "brand_id": payload.get("brand_id"),
        "brand_name": payload.get("brand_name"),
        "allowed_pages": payload.get("allowed_pages"),
        "allowed_brand_ids": payload.get("allowed_brand_ids"),
        "read_only": payload.get("read_only", False),
    }


@router.put("/users/me", tags=["auth"])
def update_my_name(payload: schemas.UserNameUpdate, current_user: models.User = Depends(get_current_user)):
    with get_db() as db:
        user = db.query(models.User).filter(models.User.id == current_user.id).first()
        user.name = payload.name.strip() or None
        db.commit()
    return {"ok": True, "name": payload.name.strip()}


# ── Brand routes ──────────────────────────────────────────────────────────────

@router.get("/brands", tags=["brands"])
def list_brands(current_user: models.User = Depends(require_admin)):
    allowed = _parse_json_list(current_user.allowed_brand_ids)
    with get_db() as db:
        q = db.query(models.Brand).order_by(models.Brand.created_at)
        if allowed is not None:
            q = q.filter(models.Brand.id.in_(allowed))
        return [{"id": b.id, "name": b.name} for b in q.all()]


@router.post("/brands", tags=["brands"])
def create_brand(payload: schemas.BrandCreate, _admin: models.User = Depends(require_admin)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Brand name is required.")
    with get_db() as db:
        if db.query(models.Brand).filter(models.Brand.name == name).first():
            raise HTTPException(status_code=400, detail="Brand name already exists.")
        brand = models.Brand(name=name)
        db.add(brand)
        db.commit()
        db.refresh(brand)
        return {"id": brand.id, "name": brand.name}


@router.delete("/brands/{brand_id_param}", tags=["brands"])
def delete_brand(brand_id_param: int, _admin: models.User = Depends(require_admin)):
    with get_db() as db:
        brand = db.query(models.Brand).filter(models.Brand.id == brand_id_param).first()
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found.")
        has_data = (
            db.query(models.CashflowMonth).filter(models.CashflowMonth.brand_id == brand_id_param).first()
            or db.query(models.Product).filter(models.Product.brand_id == brand_id_param).first()
            or db.query(models.BostaReport).filter(models.BostaReport.brand_id == brand_id_param).first()
        )
        if has_data:
            raise HTTPException(status_code=400, detail="Cannot delete brand with existing data.")
        db.delete(brand)
        db.commit()
    return {"ok": True}


@router.post("/auth/select-brand", tags=["auth"])
def select_brand(payload: schemas.BrandSelect, current_user: models.User = Depends(require_admin)):
    allowed = _parse_json_list(current_user.allowed_brand_ids)
    if allowed is not None and payload.brand_id not in allowed:
        raise HTTPException(status_code=403, detail="Access to this brand is not allowed.")
    with get_db() as db:
        brand = db.query(models.Brand).filter(models.Brand.id == payload.brand_id).first()
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found.")
        brand_name = brand.name
    token = auth.create_access_token({
        "sub": current_user.email,
        "role": "admin",
        "brand_id": payload.brand_id,
        "brand_name": brand_name,
        "allowed_pages": None,
        "allowed_brand_ids": _parse_json_list(current_user.allowed_brand_ids),
    })
    return {"access_token": token}


@router.post("/auth/clear-brand", tags=["auth"])
def clear_brand(current_user: models.User = Depends(require_admin)):
    token = auth.create_access_token({
        "sub": current_user.email,
        "role": "admin",
        "brand_id": None,
        "brand_name": None,
        "allowed_pages": None,
        "allowed_brand_ids": _parse_json_list(current_user.allowed_brand_ids),
    })
    return {"access_token": token}


# ── Admin user creation (from Admin Portal) ───────────────────────────────────

from pydantic import BaseModel as _BaseModel

class CreateAdminBody(_BaseModel):
    email:             str
    password:          str
    name:              str = ""
    allowed_brand_ids: list[int] | None = None  # None = access all brands


@router.get("/admin/admins", tags=["admin"])
def list_admin_users(current_user: models.User = Depends(require_admin)):
    with get_db() as db:
        admins = db.query(models.User).filter(
            models.User.role == models.UserRole.admin
        ).order_by(models.User.created_at).all()
        return [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name or "",
                "allowed_brand_ids": _parse_json_list(u.allowed_brand_ids),
                "created_at": u.created_at.isoformat(),
                "is_self": u.id == current_user.id,
            }
            for u in admins
        ]


class AdminBrandsBody(_BaseModel):
    allowed_brand_ids: list[int] | None  # None = all brands


@router.put("/admin/admins/{user_id}/brands", tags=["admin"])
def update_admin_brands(user_id: int, body: AdminBrandsBody, _admin: models.User = Depends(require_admin)):
    with get_db() as db:
        user = db.query(models.User).filter(
            models.User.id == user_id,
            models.User.role == models.UserRole.admin,
        ).first()
        if not user:
            raise HTTPException(status_code=404, detail="Admin user not found.")
        user.allowed_brand_ids = json.dumps(body.allowed_brand_ids) if body.allowed_brand_ids is not None else None
        db.commit()
    return {"ok": True}


@router.delete("/admin/admins/{user_id}", tags=["admin"])
def delete_admin_user(user_id: int, current_user: models.User = Depends(require_admin)):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")
    with get_db() as db:
        user = db.query(models.User).filter(
            models.User.id == user_id,
            models.User.role == models.UserRole.admin,
        ).first()
        if not user:
            raise HTTPException(status_code=404, detail="Admin user not found.")
        db.delete(user)
        db.commit()
    return {"ok": True}


@router.post("/admin/create-admin", tags=["admin"])
def create_admin_user(body: CreateAdminBody, _admin: models.User = Depends(require_admin)):
    email = body.email.strip()
    if not email or not body.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
    with get_db() as db:
        if db.query(models.User).filter(models.User.email == email).first():
            raise HTTPException(status_code=400, detail="Email already registered.")
        # Validate that all requested brand IDs exist
        if body.allowed_brand_ids is not None:
            existing_ids = {b.id for b in db.query(models.Brand).all()}
            bad = [bid for bid in body.allowed_brand_ids if bid not in existing_ids]
            if bad:
                raise HTTPException(status_code=400, detail=f"Unknown brand IDs: {bad}")
        user = models.User(
            email=email,
            password_hash=auth.hash_password(body.password),
            role=models.UserRole.admin,
            name=body.name.strip() or None,
            brand_id=None,
            allowed_brand_ids=json.dumps(body.allowed_brand_ids) if body.allowed_brand_ids is not None else None,
        )
        db.add(user)
        db.commit()
    return {"ok": True, "email": email}


# ── User management (admin only) ─────────────────────────────────────────────

@router.get("/users")
def list_users(brand_id: int = Depends(get_brand_id), _admin: models.User = Depends(require_admin)):
    with get_db() as db:
        users = db.query(models.User).filter(
            models.User.brand_id == brand_id
        ).order_by(models.User.created_at).all()
        return [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name or "",
                "role": u.role.value,
                "created_at": u.created_at.isoformat(),
                "allowed_pages": _parse_json_list(u.allowed_pages),
                "read_only": bool(u.read_only),
            }
            for u in users
        ]


@router.put("/users/{user_id}", tags=["users"])
def update_user(user_id: int, payload: schemas.UserNameUpdate, _admin: models.User = Depends(require_admin)):
    with get_db() as db:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        user.name = payload.name.strip() or None
        db.commit()
    return {"ok": True, "name": payload.name.strip()}


class UserPagesBody(_BaseModel):
    allowed_pages: list[str] | None  # None = unrestricted


@router.put("/users/{user_id}/pages", tags=["users"])
def update_user_pages(user_id: int, body: UserPagesBody, _admin: models.User = Depends(require_admin)):
    with get_db() as db:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        user.allowed_pages = json.dumps(body.allowed_pages) if body.allowed_pages is not None else None
        db.commit()
    return {"ok": True}


class UserReadOnlyBody(_BaseModel):
    read_only: bool


@router.put("/users/{user_id}/readonly", tags=["users"])
def update_user_readonly(user_id: int, body: UserReadOnlyBody, _admin: models.User = Depends(require_admin)):
    with get_db() as db:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        user.read_only = body.read_only
        db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: models.User = Depends(require_admin)):
    with get_db() as db:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        if user.id == admin.id:
            raise HTTPException(status_code=400, detail="Cannot delete your own account.")
        db.delete(user)
        db.commit()
    return {"ok": True}
