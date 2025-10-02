// web/app/admin/login/page.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiPost } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";

  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    setErr(null); setLoading(true);
    try {
      const { token } = await apiPost<{ token: string }>("/api/admin/login", { password });
      localStorage.setItem("bw_admin_token", token);
      router.push(next);
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{display:"grid",gap:12,maxWidth:420}}>
      <h2>Admin — Login</h2>
      <input
        type="password"
        placeholder="Admin password"
        value={password}
        onChange={e=>setPassword(e.target.value)}
      />
      <button onClick={login} disabled={!password.trim() || loading}>
        {loading ? "Please wait..." : "Login"}
      </button>
      {err && <div style={{color:"crimson"}}>{err}</div>}
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
