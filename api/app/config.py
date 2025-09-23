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
    code_expiry_hours: int = int(os.getenv("CODE_EXPIRY_HOURS", "24"))
    spin_cooldown_hours: int = int(os.getenv("SPIN_COOLDOWN_HOURS", "24"))
    allowed_origins: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

settings = Settings()
