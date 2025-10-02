import secrets
from typing import Sequence
from .models import Prize

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

def weighted_choice(prizes: Sequence[Prize]) -> Prize:
    active = [p for p in prizes if p.active]
    if not active:
        raise ValueError("No active prizes")
    bag = []
    for p in active:
        bag.extend([p] * max(p.weight, 0))
    return secrets.choice(bag)

def gen_code(length: int = 8) -> str:
    # 8 characters like “K7F9X2BD”
    return "".join(secrets.choice(ALPHABET) for _ in range(length))

# Stubs you can later wire to Resend/Mailgun/Twilio
def send_reward_email(to_email: str, code: str, expires_at: str, prize: str):
    print(f"[EMAIL] {to_email} -> {prize} [{code}] valid until {expires_at}")

def send_reward_sms(to_phone: str, code: str, expires_at: str, prize: str):
    print(f"[SMS] {to_phone} -> {prize} [{code}] valid until {expires_at}")
