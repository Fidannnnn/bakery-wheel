import secrets
from typing import Sequence
from .models import Prize

def weighted_choice(prizes: Sequence[Prize]) -> Prize:
    active = [p for p in prizes if p.active]
    if not active:
        raise ValueError("No active prizes")
    bag = []
    for p in active:
        bag.extend([p] * max(p.weight, 0))
    return secrets.choice(bag)

def gen_code() -> str:
    return secrets.token_urlsafe(16)

# Stubs you can later wire to Resend/Mailgun/Twilio
def send_reward_email(to_email: str, code: str, expires_at: str, prize: str):
    print(f"[EMAIL] {to_email} -> {prize} [{code}] valid until {expires_at}")

def send_reward_sms(to_phone: str, code: str, expires_at: str, prize: str):
    print(f"[SMS] {to_phone} -> {prize} [{code}] valid until {expires_at}")
