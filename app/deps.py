from contextlib import contextmanager
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from .db import SessionLocal
from . import models, auth

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = auth.decode_token(token)
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    with get_db() as db:
        user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_admin(user: models.User = Depends(get_current_user)):
    if user.role != models.UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


def get_brand_id(token: str = Depends(oauth2_scheme)) -> int:
    """Extract brand_id from the JWT. Raises 403 if admin has not selected a brand yet."""
    payload = auth.decode_token(token)
    brand_id = payload.get("brand_id")
    if brand_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No brand selected. Please select a brand first.",
        )
    return int(brand_id)
