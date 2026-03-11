from fastapi import APIRouter, Form, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.deps import get_db, get_current_user, require_admin, get_brand_id, oauth2_scheme
from app import models, schemas, auth

router = APIRouter()


@router.post("/auth/register", tags=["auth"])
def register(
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form("viewer"),
    name: str = Form(""),
    _admin: models.User = Depends(require_admin),
    brand_id: int = Depends(get_brand_id),
):
    if role not in ("admin", "viewer"):
        raise HTTPException(status_code=400, detail="Role must be admin or viewer")
    with get_db() as db:
        if db.query(models.User).filter(models.User.email == email).first():
            raise HTTPException(status_code=400, detail="Email already registered")
        user = models.User(
            email=email,
            password_hash=auth.hash_password(password),
            role=models.UserRole(role),
            name=name.strip() or None,
            brand_id=brand_id if role == "viewer" else None,
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
        with get_db() as db:
            brand = db.query(models.Brand).filter(models.Brand.id == jwt_brand_id).first()
            brand_name = brand.name if brand else None
    token = auth.create_access_token({
        "sub": user.email,
        "role": user.role.value,
        "brand_id": jwt_brand_id,
        "brand_name": brand_name,
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
def list_brands(_admin: models.User = Depends(require_admin)):
    with get_db() as db:
        brands = db.query(models.Brand).order_by(models.Brand.created_at).all()
        return [{"id": b.id, "name": b.name} for b in brands]


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
    })
    return {"access_token": token}


@router.post("/auth/clear-brand", tags=["auth"])
def clear_brand(current_user: models.User = Depends(require_admin)):
    token = auth.create_access_token({
        "sub": current_user.email,
        "role": "admin",
        "brand_id": None,
        "brand_name": None,
    })
    return {"access_token": token}


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
            }
            for u in users
        ]


@router.put("/users/{user_id}", tags=["users"])
def update_user_name(user_id: int, payload: schemas.UserNameUpdate, _admin: models.User = Depends(require_admin)):
    with get_db() as db:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        user.name = payload.name.strip() or None
        db.commit()
    return {"ok": True, "name": payload.name.strip()}


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
