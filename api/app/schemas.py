from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Literal, Optional, List

class SpinRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=7)
    device_hash: str = Field(min_length=8)

class SpinResponse(BaseModel):
    status: Literal["new", "existing_active", "already_redeemed", "expired", "cooldown"]
    message: str
    prize_name: Optional[str] = None
    prize_type: Optional[str] = None
    prize_value: Optional[str] = None
    code: Optional[str] = None
    expires_at: Optional[datetime] = None
    redeemed_at: Optional[datetime] = None
    next_spin_at: Optional[datetime] = None
    prize_id: Optional[int] = None
    wedge_index: Optional[int] = None
    wedges_count: Optional[int] = None

class RedeemRequest(BaseModel):
    code: str

class RedeemResponse(BaseModel):
    status: str
    prize_name: str | None = None
    prize_type: str | None = None
    prize_value: str | None = None
    redeemed_at: datetime | None = None

class StatusRequest(BaseModel):
    phone: Optional[str] = None
    device_hash: Optional[str] = None

class StatusResponse(BaseModel):
    status: Literal["existing_active", "already_redeemed", "expired", "none", "cooldown"]
    message: str
    prize_name: Optional[str] = None
    prize_type: Optional[str] = None
    prize_value: Optional[str] = None
    code: Optional[str] = None
    expires_at: Optional[datetime] = None
    redeemed_at: Optional[datetime] = None
    next_spin_at: Optional[datetime] = None

class ResendRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    # "auto" picks email if present, else sms
    channel: Literal["auto", "email", "sms"] = "auto"

class ResendResponse(BaseModel):
    ok: bool
    message: str

class AdminLoginRequest(BaseModel):
    password: str

class AdminLoginResponse(BaseModel):
    token: str


class PrizeIn(BaseModel):
    id: Optional[int] = None     
    name: str
    type: str                   
    value: Optional[str] = None  
    weight: int = Field(ge=0, default=0)
    active: bool = True
    icon_url: Optional[str] = None

class PrizeOut(BaseModel):
    id: int
    name: str
    type: str
    value: Optional[str] = None
    weight: int
    active: bool
    icon_url: Optional[str] = None
    class Config:
        from_attributes = True

class PrizesSetRequest(BaseModel):
    prizes: List[PrizeIn]

class PrizesSetResponse(BaseModel):
    ok: bool
    created: int
    updated: int
    deactivated: int
    message: str

class RedemptionOut(BaseModel):
    id: int
    code: str
    prize_name: Optional[str] = None
    redeemed_at: Optional[datetime] = None
    user_full_name: Optional[str] = None
    user_phone: Optional[str] = None