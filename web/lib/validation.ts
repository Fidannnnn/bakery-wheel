export function validateEmail(email: string): { ok: boolean; reason?: string } {
  const v = email.trim();
  if (!v) return { ok: false, reason: "Email is required" };
  // simple pragmatic check
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  return ok ? { ok } : { ok: false, reason: "Enter a valid email" };
}

export function normalizePhone(phone: string): string {
  // strip non-digits, keep leading +
  const trimmed = phone.trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return plus ? `+${digits}` : digits;
}

export function validatePhone(phone: string): { ok: boolean; reason?: string } {
  const norm = normalizePhone(phone);
  const digits = norm.startsWith("+") ? norm.slice(1) : norm;
  if (!digits) return { ok: false, reason: "Phone is required" };
  if (digits.length < 7 || digits.length > 15) return { ok: false, reason: "Enter a valid phone" };
  return { ok: true };
}
