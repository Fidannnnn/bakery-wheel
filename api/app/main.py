from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from .config import settings
from .db import Base, engine, get_db
from .models import User, Prize, Spin, Code
from .schemas import SpinRequest, SpinResponse, RedeemRequest, RedeemResponse
from .utils import weighted_choice, gen_code, send_reward_email, send_reward_sms

app = FastAPI(title="Bakery Wheel API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True
)

# Dev convenience: create tables if missing (OK for local dev)
Base.metadata.create_all(bind=engine)

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/api/spin", response_model=SpinResponse)
def spin(payload: SpinRequest, db: Session = Depends(get_db)):
    if not payload.email and not payload.phone:
        raise HTTPException(400, "Provide email or phone")

    user = None
    if payload.email:
        user = db.query(User).filter(User.email == payload.email).first()
    if not user and payload.phone:
        user = db.query(User).filter(User.phone == payload.phone).first()
    if not user:
        user = User(email=payload.email, phone=payload.phone, device_hash=payload.device_hash)
        db.add(user); db.commit(); db.refresh(user)

    # cooldown
    since = datetime.utcnow() - timedelta(hours=settings.spin_cooldown_hours)
    recent = db.query(Spin).filter(Spin.user_id == user.id, Spin.created_at >= since).first()
    if recent:
        raise HTTPException(429, f"Already spun within {settings.spin_cooldown_hours}h")

    # prize
    prize = weighted_choice(db.query(Prize).filter(Prize.active == True).all())

    # log spin
    s = Spin(user_id=user.id, prize_id=prize.id, device_hash=payload.device_hash)
    db.add(s); db.commit(); db.refresh(s)

    # code
    expires_at = datetime.utcnow() + timedelta(hours=settings.code_expiry_hours)
    code = Code(user_id=user.id, prize_id=prize.id, code=gen_code(), expires_at=expires_at)
    db.add(code); db.commit(); db.refresh(code)

    # notify
    iso = expires_at.replace(tzinfo=timezone.utc).isoformat()
    if user.email: send_reward_email(user.email, code.code, iso, prize.name)
    if user.phone: send_reward_sms(user.phone, code.code, iso, prize.name)

    return SpinResponse(
        prize_name=prize.name, prize_type=prize.type, prize_value=prize.value,
        code=code.code, expires_at=expires_at.replace(tzinfo=timezone.utc)
    )

@app.post("/api/redeem", response_model=RedeemResponse)
def redeem(payload: RedeemRequest, db: Session = Depends(get_db)):
    code = db.query(Code).filter(Code.code == payload.code).first()
    if not code:
        return RedeemResponse(status="invalid")

    now = datetime.utcnow()

    if code.redeemed_at:
        return RedeemResponse(
            status="already_redeemed",
            redeemed_at=code.redeemed_at.replace(tzinfo=timezone.utc)
        )

    if now > code.expires_at:
        code.status = "expired"; db.commit()
        return RedeemResponse(status="expired")

    code.status = "redeemed"; code.redeemed_at = now; db.commit()
    p = db.query(Prize).filter(Prize.id == code.prize_id).first()

    return RedeemResponse(
        status="redeemed",
        prize_name=p.name if p else None,
        prize_type=p.type if p else None,
        prize_value=p.value if p else None,
        redeemed_at=code.redeemed_at.replace(tzinfo=timezone.utc)
    )
