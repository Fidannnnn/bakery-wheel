// app/login/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { validatePhone, normalizePhone } from "@/lib/validation";

type Check = { ok: boolean; reason?: string };

function validateName(name: string): Check {
  const n = name.trim();
  if (!n) return { ok: false, reason: "Please enter your full name." };
  if (n.length < 2) return { ok: false, reason: "Name looks too short." };
  // allow letters, spaces, hyphens, apostrophes, dots
  if (!/^[\p{L} .'-]+$/u.test(n)) {
    return { ok: false, reason: "Use letters/spaces only." };
  }
  return { ok: true };
}

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/spin";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [touchedName, setTouchedName] = useState(false);
  const [touchedPhone, setTouchedPhone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Prefill from localStorage
  useEffect(() => {
    const n = localStorage.getItem("bw_full_name"); if (n) setFullName(n);
    const p = localStorage.getItem("bw_phone"); if (p) setPhone(p);
  }, []);

  const nV = validateName(fullName);
  const pV = validatePhone(phone);
  const canGo = useMemo(() => nV.ok && pV.ok, [nV.ok, pV.ok]);

  function doLogin() {
    if (!canGo || loading) return;
    setLoading(true);
    try {
      localStorage.setItem("bw_full_name", fullName.trim());
      localStorage.setItem("bw_phone", normalizePhone(phone));
      document.cookie = `bw_user=1; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.push(next);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") doLogin();
  }

  return (
    <div style={wrap}>
      <main style={card} aria-labelledby="login-title">
        <header style={head}>
          <h2 id="login-title" style={{ margin: 0, color: "#1f2937" }}>Welcome</h2>
          <p style={{ margin: 0, color: "#4b5563" }}>
            Sign in to spin the wheel
          </p>
        </header>

        <section style={{ display: "grid", gap: 14 }}>
          <label style={label}>
            <span style={labelText}>Full name</span>
            <input
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              onBlur={() => setTouchedName(true)}
              onKeyDown={onKeyDown}
              placeholder="Jane Doe"
              aria-invalid={touchedName && !nV.ok}
              aria-describedby="name-help"
              style={{
                ...input,
                ...(fullName ? (nV.ok ? inputOk : inputErr) : {}),
              }}
            />
            <small id="name-help" style={hintText}>
              Please enter your first and last name.
            </small>
            {touchedName && !nV.ok && (
              <small style={errText}>{nV.reason}</small>
            )}
          </label>

          <label style={label}>
            <span style={labelText}>Phone</span>
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onBlur={() => setTouchedPhone(true)}
              onKeyDown={onKeyDown}
              placeholder="+994 55 123 45 67"
              aria-invalid={touchedPhone && !pV.ok}
              aria-describedby="phone-help"
              style={{
                ...input,
                ...(phone ? (pV.ok ? inputOk : inputErr) : {}),
              }}
            />
            <small id="phone-help" style={hintText}>
              Include country code (e.g., +994…).
            </small>
            {touchedPhone && !pV.ok && (
              <small style={errText}>{pV.reason}</small>
            )}
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={doLogin}
              disabled={!canGo || loading}
              style={{ ...btnPrimary, opacity: (!canGo || loading) ? 0.8 : 1 }}
              title={!canGo ? "Fill both fields correctly" : ""}
            >
              {loading ? "Please wait…" : "Continue"}
            </button>
            <a href="/" style={btnGhost as React.CSSProperties}>Back</a>
          </div>

          <small style={{ color: "#6b7280" }}>
            We store your name & phone locally for convenience. You can change them later.
          </small>
        </section>
      </main>
    </div>
  );
}

/* ---------- Light theme to match your light Spin page ---------- */

const wrap: React.CSSProperties = {
  minHeight: "100dvh",
  background:
    "radial-gradient(900px 500px at 10% -10%, #fff3e6 0%, rgba(255,255,255,0) 60%)," +
    "radial-gradient(1100px 700px at 120% 20%, #ffe8f0 0%, rgba(255,255,255,0) 55%)," +
    "linear-gradient(180deg, #ffffff, #fafafa)",
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: "#1f2937",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow:
    "0 10px 30px rgba(17, 24, 39, 0.08), 0 2px 6px rgba(17, 24, 39, 0.05)",
  padding: 24,
  display: "grid",
  gap: 16,
};

const head: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelText: React.CSSProperties = {
  fontSize: 14,
  color: "#374151",
  fontWeight: 600,
};

const hintText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 12,
};

const input: React.CSSProperties = {
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  outline: "none",
  boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
};

const inputOk: React.CSSProperties = {
  borderColor: "#10b981",
  boxShadow: "0 0 0 3px rgba(16,185,129,0.15)",
};

const inputErr: React.CSSProperties = {
  borderColor: "#ef4444",
  boxShadow: "0 0 0 3px rgba(239,68,68,0.15)",
};

const errText: React.CSSProperties = {
  color: "#b91c1c",
  fontWeight: 600,
};

const btnPrimary: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid #fb923c",
  background: "linear-gradient(180deg, #fbbf24 0%, #fb923c 100%)", // amber → orange
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  boxShadow: "0 8px 20px rgba(251,146,60,0.35)",
};

const btnGhost: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  color: "#374151",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};
