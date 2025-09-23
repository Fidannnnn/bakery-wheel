from pydantic import BaseModel, EmailStr
from datetime import datetime

class SpinRequest(BaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    device_hash: str | None = None

class SpinResponse(BaseModel):
    prize_name: str
    prize_type: str
    prize_value: str | None
    code: str
    expires_at: datetime

class RedeemRequest(BaseModel):
    code: str

class RedeemResponse(BaseModel):
    status: str
    prize_name: str | None = None
    prize_type: str | None = None
    prize_value: str | None = None
    redeemed_at: datetime | None = None
