// web/app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    // consider user "logged in" if cookie is set or email+phone exist in localStorage
    const hasCookie = document.cookie.split("; ").some(c => c.startsWith("bw_user="));
    const hasStoredCreds = !!localStorage.getItem("bw_full_name") && !!localStorage.getItem("bw_phone");    setLoggedIn(hasCookie || hasStoredCreds);
  }, []);

  const href = loggedIn ? "/spin" : "/login?next=/spin";
  const label = loggedIn ? "Go to spin" : "Sign in to spin";

  return (
    <div style={wrap}>
      <main style={wrap}>
        <div style={{display:"grid", gap:14}}>
          <h1 style={title}>Bakery Wheel</h1>
          <p style={subtitle}>
            Spin for a chance to win discounts and treats. One spin per {cooldownCopy()}.
          </p>

          <div style={{marginTop:8}}>
            <Link href={href} style={btnPrimary}>
              {label}
            </Link>
          </div>

          <p style={hint}>
            You’ll be asked for your email and phone on first sign in so we can deliver your code.
          </p>
        </div>
      </main>
    </div>
  );
}

/* ---- helpers / styles ---- */

function cooldownCopy() {
  // keep text neutral; the actual hours are enforced server-side
  return "cooldown period";
}

const wrap: React.CSSProperties = {
  minHeight: "100dvh",
  background: "#fff7ec",
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: "#3f2a26",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 620,
  borderRadius: 18,
  border: "1px solid #f1e1cf",
  background: "#fffaf3",
  boxShadow: "0 10px 40px rgba(119,72,57,.12)",
  padding: 28,
  display: "grid",
  gap: 16,
  textAlign: "center",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-block",
  margin: "8px auto 0",
  padding: "12px 20px",
  borderRadius: 12,
  border: "1px solid #b24a3b",
  background: "linear-gradient(180deg, #ff8f7e, #e76a5a)",
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(178,74,59,.25)",
};
const title: React.CSSProperties = {
  margin: 0,
  fontSize: 32,
  letterSpacing: 0.3,
};

const subtitle: React.CSSProperties = {
  margin: 0,
  opacity: 0.85,
};

const hint: React.CSSProperties = {
  margin: 0,
  opacity: 0.65,
  fontSize: 13,
};

