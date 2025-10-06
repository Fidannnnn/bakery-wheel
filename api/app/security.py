import bcrypt, secrets
from datetime import datetime, timedelta, timezone
from jose import jwt
from .config import settings

def verify_admin_password(plaintext: str) -> bool:
    # Prefer secure hash if provided
    if settings.admin_password_hash:
        try:
            return bcrypt.checkpw(
                plaintext.encode("utf-8"),
                settings.admin_password_hash.encode("utf-8"),
            )
        except Exception:
            return False
    # Fallback: compare to plaintext env
    if settings.admin_password:
        return secrets.compare_digest(plaintext, settings.admin_password)
    return False

def make_admin_token() -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.admin_token_hours)
    return jwt.encode({"sub": "admin", "exp": exp}, settings.jwt_secret, algorithm="HS256")
