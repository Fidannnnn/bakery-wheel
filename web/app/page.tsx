// web/app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const hasCookie = document.cookie.split("; ").some(c => c.startsWith("bw_user="));
    const hasStoredCreds =
      !!localStorage.getItem("bw_full_name") && !!localStorage.getItem("bw_phone");
    setLoggedIn(hasCookie || hasStoredCreds);
  }, []);

  const href = loggedIn ? "/spin" : "/login?next=/spin";
  const label = loggedIn ? "Çarxa keç" : "Fırlatmaq üçün daxil ol";

  return (
    <div style={wrap}>
      <main style={card}>
        <div style={{ display: "grid", gap: 14 }}>
          <h1 style={title}>Fırın Çarxı</h1>
          <p style={subtitle}>
            Endirim və şirniyyat qazanmaq şansı üçün çarxı fırladın. Hər həftə bir dəfə fırlatmaq olar.
          </p>

          <div style={{ marginTop: 8 }}>
            <Link href={href} style={btnPrimary}>
              {label}
            </Link>
          </div>

          <p style={hint}>
            İlk girişdə kodu sizə göndərə bilmək üçün e-poçt və telefon nömrəniz istəniləcək.
          </p>
        </div>
      </main>
    </div>
  );
}

/* ---- helpers / styles ---- */

function cooldownCopy() {
  // server still enforces real hours
  return "gözləmə müddəti";
}

/* lively “wheel” theme */
const wrap: React.CSSProperties = {
  minHeight: "100dvh",
  background:
    "radial-gradient(1000px 600px at 10% -10%, #ffecd2 0%, rgba(255,255,255,0) 60%)," +
    "radial-gradient(1200px 800px at 120% 20%, #ffe8f0 0%, rgba(255,255,255,0) 55%)," +
    "linear-gradient(180deg, #fffaf3 0%, #fff2de 100%)",
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: "#1f1b17",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 680,
  borderRadius: 18,
  border: "1px solid #ffd9b5",
  background: "#fffdf8",
  boxShadow: "0 14px 44px rgba(255, 91, 0, 0.28)",
  padding: 28,
  display: "grid",
  gap: 16,
  textAlign: "center",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-block",
  margin: "8px auto 0",
  padding: "12px 22px",
  borderRadius: 12,
  border: "1px solid #ff5a00",
  background: "linear-gradient(180deg, #ff7b00 0%, #ff3b2e 100%)",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 12px 26px rgba(255,59,46,.4)",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  letterSpacing: 0.3,
  color: "#7a2b15",
};

const subtitle: React.CSSProperties = {
  margin: 0,
  opacity: 0.95,
  color: "#a33b25",
  fontSize: 16,
};

const hint: React.CSSProperties = {
  margin: 0,
  opacity: 0.75,
  fontSize: 13,
  color: "#b85b3e",
};
