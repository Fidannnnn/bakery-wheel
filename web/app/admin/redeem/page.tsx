// web/app/admin/redeem/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type RedeemResponse = {
  status: "redeemed" | "invalid" | "expired" | "already_redeemed";
  prize_name?: string | null;
  prize_type?: string | null;
  prize_value?: string | null;
  redeemed_at?: string | null;
};

export default function AdminRedeemPage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [res, setRes] = useState<RedeemResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If there's no admin token, bounce to admin login.
  useEffect(() => {
    const token = localStorage.getItem("bw_admin_token");
    if (!token) router.replace("/admin/login?next=/admin/redeem");
  }, [router]);

  async function redeem() {
    setErr(null);
    setRes(null);

    const token = localStorage.getItem("bw_admin_token");
    if (!token) {
      router.replace("/admin/login?next=/admin/redeem");
      return;
    }

    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const r = await fetch(`${base}/api/admin/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (!r.ok) {
        // Try to show API error message
        let detail = "Failed to redeem";
        try {
          const j = await r.json();
          detail = j?.detail || j?.message || detail;
        } catch {}
        // If token expired/invalid, redirect to login
        if (r.status === 401 || r.status === 403) {
          setErr("Session expired. Please log in again.");
          localStorage.removeItem("bw_admin_token");
          router.replace("/admin/login?next=/admin/redeem");
          return;
        }
        throw new Error(detail);
      }

      const data = (await r.json()) as RedeemResponse;
      setRes(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to redeem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <h2>Admin — Redeem</h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste / scan customer code"
          onKeyDown={(e) => e.key === "Enter" && redeem()}
          style={{ flex: 1 }}
        />
        <button onClick={redeem} disabled={!code.trim() || loading}>
          {loading ? "Please wait..." : "Redeem"}
        </button>
        <button onClick={() => { setCode(""); setRes(null); setErr(null); }}>
          Clear
        </button>
      </div>

      {err && <div style={{ color: "crimson" }}>{err}</div>}

      {res && (
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
          <div>
            <b>Status:</b> {res.status}
          </div>
          {res.prize_name && (
            <div>
              <b>Prize:</b> {res.prize_name}
              {res.prize_value ? ` (${res.prize_value})` : ""}
            </div>
          )}
          {res.redeemed_at && (
            <div>
              <b>Redeemed at:</b>{" "}
              {new Date(res.redeemed_at).toLocaleString()}
            </div>
          )}
        </div>

      )}
      <div style={backRow}>
        <a href="/admin" style={backBtn}>← Back to Admin</a>
      </div>
    </main>
  );
}
const backRow: React.CSSProperties = { marginBottom: 8 };
const backBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #e5e5e5",
  background: "#fff",
  color: "#374151",
  fontWeight: 600,
  textDecoration: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,.04)",
};
