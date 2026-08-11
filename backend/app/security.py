"""Auth: хэш паролей (bcrypt), JWT access-токен, зависимости RBAC (З12)."""
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import AdminUser

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/admin/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(sub: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_ttl_min)
    payload = {"sub": sub, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> AdminUser:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="unauthorized",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        sub = payload.get("sub")
    except jwt.PyJWTError:
        raise credentials_exc
    if not sub:
        raise credentials_exc
    try:
        user_id = uuid.UUID(sub)
    except (ValueError, TypeError):
        raise credentials_exc
    user = db.get(AdminUser, user_id)
    if user is None or not user.is_active:
        raise credentials_exc
    return user


def require_role(*roles: str):
    """Зависимость: пускает только перечисленные роли (иначе 403).
    admin (Суперадмин) имеет доступ ко всему по умолчанию."""

    def dep(user: AdminUser = Depends(get_current_user)) -> AdminUser:
        if user.role == "admin":
            return user
        if roles and user.role in roles:
            return user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    return dep
