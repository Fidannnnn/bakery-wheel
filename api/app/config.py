import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
if ENV_PATH.exists():
    # ensure .env values override empty/previous env
    load_dotenv(ENV_PATH, override=True)
    # BOM-safe fallback: if key was \ufeffDATABASE_URL
    if not os.getenv("DATABASE_URL"):
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.lstrip("\ufeff")
            if line.startswith("DATABASE_URL="):
                os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip()
                break

class Settings(BaseModel):
    database_url: str = os.getenv("DATABASE_URL", "")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev_change_me")
    code_expiry_hours: float = float(os.getenv("CODE_EXPIRY_HOURS", "0.01667"))
    spin_cooldown_hours: float = float(os.getenv("SPIN_COOLDOWN_HOURS", "0.01667"))
    allowed_origins: list[str] = [
        o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()
    ]    
    allowed_origin_regex: str | None = os.getenv("ALLOWED_ORIGIN_REGEX") or None

    # NEW:
    admin_password: str = os.getenv("ADMIN_PASSWORD", "raviraIsTheBest")
    admin_token_hours: int = int(os.getenv("ADMIN_TOKEN_HOURS", "24"))
    admin_password_hash: str = os.getenv("ADMIN_PASSWORD_HASH", "$2b$12$pS0OnyLheo8sb9U983Vr7uyuYpmaw1J248ZBDAxLvCNI6zX6SZeMy")  # bcrypt hash

settings = Settings()
