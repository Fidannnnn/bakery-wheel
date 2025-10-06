from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Request, Path
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError   

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings
from .db import Base, engine, get_db
from .models import User, Prize, Spin, Code
from .schemas import SpinRequest, SpinResponse, RedeemRequest, RedeemResponse
from .schemas import StatusRequest, StatusResponse, ResendRequest, ResendResponse
from .schemas import AdminLoginRequest, AdminLoginResponse
from .schemas import PrizeIn, PrizeOut, PrizesSetRequest, PrizesSetResponse
from .utils import weighted_choice, gen_code, send_reward_email, send_reward_sms

from jose import jwt, JWTError
from fastapi import Header, status

import bcrypt, secrets

from pydantic import BaseModel

def utcnow() -> datetime:
    """UTC-aware 'now' to keep comparisons consistent with timestamptz from Postgres."""
    return datetime.now(timezone.utc)

ALGO = "HS256"

def make_admin_token() -> str:
    exp = int(utcnow().timestamp()) + settings.admin_token_hours * 3600
    payload = {"role": "admin", "exp": exp}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGO)

def verify_admin_password(plaintext: str) -> bool:
    """
    Prefer ADMIN_PASSWORD_HASH (bcrypt $2b$...); fall back to ADMIN_PASSWORD (plaintext).
    """
    if settings.admin_password_hash:
        try:
            return bcrypt.checkpw(
                plaintext.encode("utf-8"),
                settings.admin_password_hash.encode("utf-8"),
            )
        except Exception:
            return False
    if settings.admin_password:
        return secrets.compare_digest(plaintext, settings.admin_password)
    return False

def require_admin(authorization: str | None = Header(default=None, alias="Authorization")):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGO])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin")
    return True


def normalize_phone(p: str) -> str:
    return "".join(ch for ch in p if ch.isdigit())

def find_user(db: Session, email: str | None, phone: str | None, device_hash: str | None):
    pn = normalize_phone(phone) if phone else None
    by_phone = db.query(User).filter(User.phone == pn).first() if pn else None
    by_device = db.query(User).filter(User.device_hash == device_hash).first() if device_hash else None

    # prefer exact matches in order: email, phone, device
    for u in (by_phone, by_device):
        if u: return u
    return None



app = FastAPI(title="Bakery Wheel API")

# CORS (dev-friendly): allow explicit origins from .env AND localhost/127.*
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,           # exact list
    allow_origin_regex=settings.allowed_origin_regex, # regex (e.g. r"^https://.*\.vercel\.app$")
    allow_credentials=True,                           # ok; you use Authorization header, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
'''
from fastapi.middleware.cors import CORSMiddleware
origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
'''

# Dev convenience: create tables if they don't exist
Base.metadata.create_all(bind=engine)


@app.exception_handler(StarletteHTTPException)
async def http_exc_handler(request: Request, exc: StarletteHTTPException):
  return JSONResponse(status_code=exc.status_code, content={"message": str(exc.detail), "code": "HTTP_ERROR"})

@app.exception_handler(RequestValidationError)
async def validation_exc_handler(request: Request, exc: RequestValidationError):
  return JSONResponse(status_code=422, content={"message": "Validation error", "code": "VALIDATION_ERROR", "errors": exc.errors()})


@app.get("/health")
def health():
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8080)),
        reload=False,
    )

@app.post("/api/spin", response_model=SpinResponse)
def spin(payload: SpinRequest, db: Session = Depends(get_db)):
    # require all 3 inputs (pydantic already enforces)
    phone_norm = normalize_phone(payload.phone)
    if len(phone_norm) < 7:
        raise HTTPException(status_code=422, detail="Phone number looks invalid")

    # find existing user by either
    by_phone = db.query(User).filter(User.phone == phone_norm).first()
    by_device = db.query(User).filter(User.device_hash == payload.device_hash).first()

    if by_device and by_phone and by_device.id != by_phone.id:
        raise HTTPException(status_code=409, detail="Phone belong to different users")

    user = by_phone or by_device
    if not user:
        user = User(
            full_name=payload.full_name.strip(),
            phone=phone_norm,
            device_hash=payload.device_hash,
        )
        db.add(user); db.commit(); db.refresh(user)
    else:
        updated = False
        if not user.full_name:
            user.full_name = payload.full_name; updated = True
        if not user.phone:
            user.phone = phone_norm; updated = True
        if payload.device_hash and user.device_hash != payload.device_hash:
            user.device_hash = payload.device_hash; updated = True
        if updated:
            db.commit(); db.refresh(user)

    now = utcnow()

    # latest code (any status) & latest spin (for cooldown math)
    latest_code = (
        db.query(Code)
          .filter(Code.user_id == user.id)
          .order_by(Code.issued_at.desc())
          .first()
    )
    latest_spin = (
        db.query(Spin)
          .filter(Spin.user_id == user.id)
          .order_by(Spin.created_at.desc())
          .first()
    )

    # 1) Has active (issued + not expired) code? -> show it.
    if latest_code and latest_code.status == "issued":
        exp = latest_code.expires_at
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp and exp > now:
            p = db.query(Prize).filter(Prize.id == latest_code.prize_id).first()
            return SpinResponse(
                status="existing_active",
                message="You already spun — here’s your code.",
                prize_name=p.name if p else None,
                prize_type=p.type if p else None,
                prize_value=p.value if p else None,
                code=latest_code.code,
                expires_at=exp,
            )

    # 2) If last code is redeemed → tell them when; then apply cooldown gate.
    if latest_code and latest_code.status == "redeemed":
        ra = latest_code.redeemed_at
        if ra and ra.tzinfo is None:
            ra = ra.replace(tzinfo=timezone.utc)
        # cooldown boundary
        next_spin_at = None
        if latest_spin:
            next_spin_at = latest_spin.created_at + timedelta(hours=settings.spin_cooldown_hours)
            if next_spin_at.tzinfo is None:
                next_spin_at = next_spin_at.replace(tzinfo=timezone.utc)

        # if still cooling down, return info instead of 429
        if next_spin_at and now < next_spin_at:
            return SpinResponse(
                status="already_redeemed",
                message="You already used your last code.",
                redeemed_at=ra,
                next_spin_at=next_spin_at,
            )

    # 3) If last code expired, either still cooldown or proceed
    if latest_code and (latest_code.status == "expired" or (latest_code.expires_at and latest_code.expires_at <= now)):
        next_spin_at = None
        if latest_spin:
            next_spin_at = latest_spin.created_at + timedelta(hours=settings.spin_cooldown_hours)
            if next_spin_at.tzinfo is None:
                next_spin_at = next_spin_at.replace(tzinfo=timezone.utc)
        if next_spin_at and now < next_spin_at:
            return SpinResponse(
                status="expired",
                message="Your previous code expired.",
                expires_at=latest_code.expires_at if latest_code.expires_at else None,
                next_spin_at=next_spin_at,
            )

    # 4) If no active code, enforce cooldown before issuing a new one
    if latest_spin:
        next_spin_at = latest_spin.created_at + timedelta(hours=settings.spin_cooldown_hours)
        if next_spin_at.tzinfo is None:
            next_spin_at = next_spin_at.replace(tzinfo=timezone.utc)
        if now < next_spin_at:
            return SpinResponse(
                status="cooldown",
                message=f"Already spun within {settings.spin_cooldown_hours}h.",
                next_spin_at=next_spin_at,
            )

    # 5) Fresh spin -> pick prize, log spin, create code
    available = db.query(Prize).filter(Prize.active == True, Prize.weight > 0).all()
    if not available:
        # No admin-configured prizes to draw from
        raise HTTPException(status_code=503, detail="No active prizes configured. Ask staff.")
    prize = weighted_choice(available)


    s = Spin(user_id=user.id, prize_id=prize.id, device_hash=payload.device_hash)
    db.add(s); db.commit(); db.refresh(s)

    expires_at = now + timedelta(hours=settings.code_expiry_hours)

    # Create a unique short code (retry if a random collision happens)
    code_obj = None
    for _ in range(6):  # try a few times
        candidate = gen_code(8)  # 8 characters like K7F9X2BD; change to 10 if you prefer
        code_obj = Code(user_id=user.id, prize_id=prize.id, code=candidate, expires_at=expires_at)
        db.add(code_obj)
        try:
            db.commit()
            db.refresh(code_obj)
            break
        except IntegrityError:
            db.rollback()
            code_obj = None

    if not code_obj:
        raise HTTPException(status_code=500, detail="Could not generate a unique code, please try again.")


    # If you’re fully dropping SMS, comment this out:
    # if user.phone:
    #     send_reward_sms(user.phone, code_obj.code, iso, prize.name)

    return SpinResponse(
        status="new",
        message="Here’s your reward code!",
        prize_name=prize.name,
        prize_type=prize.type,
        prize_value=prize.value,
        code=code_obj.code,
        expires_at=expires_at,
    )

# Replace your existing /api/redeem with this admin-protected version:
@app.post("/api/admin/redeem", response_model=RedeemResponse)
def admin_redeem(payload: RedeemRequest, db: Session = Depends(get_db), _=Depends(require_admin)):
    code = db.query(Code).filter(Code.code == payload.code).first()
    if not code:
        return RedeemResponse(status="invalid")

    now = utcnow()
    exp = code.expires_at
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)

    if code.redeemed_at:
        ra = code.redeemed_at
        if ra and ra.tzinfo is None:
            ra = ra.replace(tzinfo=timezone.utc)
        return RedeemResponse(status="already_redeemed", redeemed_at=ra)

    if exp and now > exp:
        code.status = "expired"; db.commit()
        return RedeemResponse(status="expired")

    code.status = "redeemed"; code.redeemed_at = now; db.commit()
    p = db.query(Prize).filter(Prize.id == code.prize_id).first()
    return RedeemResponse(
        status="redeemed",
        prize_name=p.name if p else None,
        prize_type=p.type if p else None,
        prize_value=p.value if p else None,
        redeemed_at=code.redeemed_at,
    )


@app.post("/api/status", response_model=StatusResponse)
def status(payload: StatusRequest, db: Session = Depends(get_db)):
    if not (payload.phone or payload.device_hash):
        return StatusResponse(status="none", message="Provide an identifier to check status.")

    user = find_user(db, None, payload.phone, payload.device_hash)
    if not user:
        return StatusResponse(status="none", message="No spins or codes found for this user.")

    now = utcnow()
    latest_code = (
        db.query(Code).filter(Code.user_id == user.id).order_by(Code.issued_at.desc()).first()
    )
    latest_spin = (
        db.query(Spin).filter(Spin.user_id == user.id).order_by(Spin.created_at.desc()).first()
    )

    if latest_code:
        # normalize tz
        exp = latest_code.expires_at
        if exp and exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
        ra = latest_code.redeemed_at
        if ra and ra.tzinfo is None: ra = ra.replace(tzinfo=timezone.utc)

        if latest_code.status == "issued" and exp and exp > now:
            p = db.query(Prize).filter(Prize.id == latest_code.prize_id).first()
            return StatusResponse(
                status="existing_active",
                message="You already have an active code.",
                prize_name=p.name if p else None,
                prize_type=p.type if p else None,
                prize_value=p.value if p else None,
                code=latest_code.code,
                expires_at=exp,
            )
        if latest_code.status == "redeemed":
            next_spin_at = None
            if latest_spin:
                next_spin_at = latest_spin.created_at + timedelta(hours=settings.spin_cooldown_hours)
                if next_spin_at.tzinfo is None: next_spin_at = next_spin_at.replace(tzinfo=timezone.utc)
            return StatusResponse(
                status="already_redeemed",
                message="Your last code was already redeemed.",
                redeemed_at=ra,
                next_spin_at=next_spin_at,
            )
        if latest_code.status == "expired" or (exp and exp <= now):
            next_spin_at = None
            if latest_spin:
                next_spin_at = latest_spin.created_at + timedelta(hours=settings.spin_cooldown_hours)
                if next_spin_at.tzinfo is None: next_spin_at = next_spin_at.replace(tzinfo=timezone.utc)
            return StatusResponse(
                status="expired",
                message="Your last code expired.",
                expires_at=exp,
                next_spin_at=next_spin_at,
            )

    # no code history; maybe on cooldown from a logged spin (rare)
    if latest_spin:
        next_spin_at = latest_spin.created_at + timedelta(hours=settings.spin_cooldown_hours)
        if next_spin_at.tzinfo is None: next_spin_at = next_spin_at.replace(tzinfo=timezone.utc)
        if now < next_spin_at:
            return StatusResponse(
                status="cooldown",
                message="You’re on cooldown.",
                next_spin_at=next_spin_at,
            )

    return StatusResponse(status="none", message="No active code.")

@app.post("/api/resend", response_model=ResendResponse)
def resend(_: ResendRequest):
    # Email/SMS delivery is turned off
    return ResendResponse(ok=False, message="Delivery is disabled.")


@app.post("/api/admin/login", response_model=AdminLoginResponse)
def admin_login(body: AdminLoginRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    _rate_limit(ip)

    if not verify_admin_password(body.password):
        _mark_fail(ip)
        raise HTTPException(status_code=401, detail="Wrong password")

    _clear_fail(ip)
    return AdminLoginResponse(token=make_admin_token())

_failed: dict[str, list[float]] = {}
MAX_ATTEMPTS = 5
WINDOW_SEC = 15 * 60  # 15 minutes

def _now_s() -> float: return utcnow().timestamp()

def _rate_limit(ip: str):
    t = _now_s()
    arr = [x for x in _failed.get(ip, []) if t - x < WINDOW_SEC]
    _failed[ip] = arr
    if len(arr) >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Try later.")

def _mark_fail(ip: str):
    _failed.setdefault(ip, []).append(_now_s())

def _clear_fail(ip: str):
    _failed.pop(ip, None)

# --- Admin analytics ---
@app.post("/api/admin/analytics")
def admin_analytics(db: Session = Depends(get_db), _=Depends(require_admin)):
    now = utcnow()

    totals = {
        "users": db.query(User).count(),
        "spins": db.query(Spin).count(),
        "codes": db.query(Code).count(),
        "redeemed": db.query(Code).filter(Code.status == "redeemed").count(),
        "expired": db.query(Code).filter(
            (Code.status == "expired") | ((Code.status == "issued") & (Code.expires_at <= now))
        ).count(),
        "active": db.query(Code).filter(
            (Code.status == "issued") & (Code.expires_at > now)
        ).count(),
    }

    prizes_stats = []
    prizes = db.query(Prize).all()
    for p in prizes:
        issued = db.query(Code).filter(Code.prize_id == p.id).count()
        redeemed = db.query(Code).filter(Code.prize_id == p.id, Code.status == "redeemed").count()
        expired = db.query(Code).filter(
            Code.prize_id == p.id,
            (Code.status == "expired") | ((Code.status == "issued") & (Code.expires_at <= now))
        ).count()
        prizes_stats.append({
            "prize_id": p.id,
            "prize_name": p.name,
            "issued": issued,
            "redeemed": redeemed,
            "expired": expired,
        })

    rows = (
        db.query(Code, User, Prize)
          .join(User, Code.user_id == User.id)
          .join(Prize, Code.prize_id == Prize.id)
          .filter(Code.status == "redeemed")
          .order_by(Code.redeemed_at.desc())
          .limit(10)
          .all()
    )
    recent = []
    for c, u, p in rows:
        ra = c.redeemed_at
        if ra and ra.tzinfo is None:
            ra = ra.replace(tzinfo=timezone.utc)
        recent.append({
            "code": c.code,
            "redeemed_at": ra.isoformat() if ra else None,
            "prize": p.name,
            "user_name": u.full_name,
            "user_phone": u.phone,
        })

    return {"totals": totals, "prizes": prizes_stats, "recent": recent}

@app.get("/api/admin/prizes", response_model=list[PrizeOut])
def admin_list_prizes(db: Session = Depends(get_db), _=Depends(require_admin)):
    return db.query(Prize).order_by(Prize.id.asc()).all()

@app.put("/api/admin/prizes", response_model=PrizesSetResponse)
def admin_set_prizes(payload: PrizesSetRequest, db: Session = Depends(get_db), _=Depends(require_admin)):
    # Validate there is at least one active prize with weight > 0
    active_with_weight = [p for p in payload.prizes if p.active and p.weight > 0]
    if not active_with_weight:
        raise HTTPException(status_code=422, detail="At least one active prize with weight > 0 is required.")

    # Map incoming by id (when present)
    incoming_by_id = {p.id: p for p in payload.prizes if p.id}
    incoming_new     = [p for p in payload.prizes if not p.id]

    existing = db.query(Prize).all()
    existing_by_id = {e.id: e for e in existing}

    created = updated = 0

    # Update existing that are in payload
    for pid, pin in incoming_by_id.items():
        if pid not in existing_by_id:
            raise HTTPException(status_code=404, detail=f"Prize id {pid} not found.")
        e = existing_by_id[pid]
        e.name   = pin.name
        e.type   = pin.type
        e.value  = pin.value
        e.weight = pin.weight
        e.active = pin.active
        updated += 1

    # Create new
    for pin in incoming_new:
        e = Prize(name=pin.name, type=pin.type, value=pin.value, weight=pin.weight, active=pin.active)
        db.add(e)
        created += 1

    db.flush()  # get new ids if needed

    # Deactivate prizes that exist but are omitted from payload (soft remove)
    incoming_ids = set([p.id for p in payload.prizes if p.id])
    to_deactivate = db.query(Prize).filter(~Prize.id.in_(incoming_ids)).all()
    deactivated = 0
    for e in to_deactivate:
        if e.active:  # only flip those currently active
            e.active = False
            deactivated += 1

    db.commit()

    return PrizesSetResponse(
        ok=True,
        created=created,
        updated=updated,
        deactivated=deactivated,
        message=f"Saved. Created {created}, updated {updated}, deactivated {deactivated}."
    )

@app.delete("/api/admin/prizes/{prize_id}")
def admin_delete_prize(
    prize_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    p = db.query(Prize).filter(Prize.id == prize_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Prize not found")
    db.delete(p)
    db.commit()
    return {"ok": True}

@app.get("/api/admin/redemptions")
def admin_redemptions(db: Session = Depends(get_db), _=Depends(require_admin)):
    q = (
        db.query(Code, User, Prize)
          .join(User, Code.user_id == User.id)
          .join(Prize, Code.prize_id == Prize.id, isouter=True)
          .filter(Code.status == "redeemed")
          .order_by(Code.redeemed_at.desc())
          .all()
    )
    out = []
    for code, user, prize in q:
        out.append({
            "id": code.id,
            "code": code.code,
            "prize_name": prize.name if prize else None,
            "redeemed_at": (code.redeemed_at.replace(tzinfo=timezone.utc) if code.redeemed_at and code.redeemed_at.tzinfo is None else code.redeemed_at),
            "user_name": user.full_name,
            "user_phone": user.phone,
        })
    return out

class PrizePublic(BaseModel):
    id: int
    name: str
    value: Optional[str] = None
    weight: int
    class Config:
        from_attributes = True

@app.get("/api/prizes", response_model=List[PrizePublic])
def public_prizes(db: Session = Depends(get_db)):
    prizes = (
        db.query(Prize)
          .filter(Prize.active == True)
          .order_by(Prize.id.asc())
          .all()
    )
    return prizes