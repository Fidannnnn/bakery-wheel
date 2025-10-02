// web/app/admin/analytics/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

type Analytics = {
  totals: { users: number; spins: number; codes: number; redeemed: number; expired: number; active: number };
  prizes: { prize_id: number; prize_name: string; issued: number; redeemed: number; expired: number }[];
  recent: { code: string; redeemed_at: string; prize: string; user_full_name: string | null; user_phone: string | null }[];
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("bw_admin_token");
    if (!t) { router.replace("/admin/login?next=/admin/analytics"); return; }
    (async () => {
      try {
        const r = await apiPost<Analytics>("/api/admin/analytics", {}, { admin: true });
        setData(r);
      } catch (e: any) {
        setErr(e.message || "Failed to load analytics");
      }
    })();
  }, [router]);

  if (err) return <main><h3>Analytics</h3><div style={{color:"crimson"}}>{err}</div></main>;
  if (!data) return <main><h3>Analytics</h3><div>Loading…</div></main>;

  return (
    <main style={{display:"grid",gap:16}}>
      <h3>Analytics</h3>
      <div style={backRow}>
        <a href="/admin" style={backBtn}>← Back to Admin</a>
      </div>
      <section style={{display:"grid",gridTemplateColumns:"repeat(3, minmax(140px, 1fr))", gap:12}}>
        {Object.entries(data.totals).map(([k,v])=>(
          <div key={k} style={{border:"1px solid #ddd", borderRadius:8, padding:12}}>
            <div style={{opacity:0.7}}>{k}</div>
            <div style={{fontSize:24, fontWeight:600}}>{v}</div>
          </div>
        ))}
      </section>

      <section>
        <h4>By prize</h4>
        <table style={{borderCollapse:"collapse", width:"100%"}}>
          <thead>
            <tr><th align="left">Prize</th><th align="right">Issued</th><th align="right">Redeemed</th><th align="right">Expired</th></tr>
          </thead>
          <tbody>
            {data.prizes.map(p=>(
              <tr key={p.prize_id}>
                <td>{p.prize_name}</td>
                <td align="right">{p.issued}</td>
                <td align="right">{p.redeemed}</td>
                <td align="right">{p.expired}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h4>Recent redemptions</h4>
        <ul>
          {data.recent.map((r,i)=>(
            <li key={i}>
              <code>{r.code}</code> · {r.prize} · {new Date(r.redeemed_at).toLocaleString()}
              { (r.user_full_name || r.user_phone) && <> — {r.user_full_name ?? r.user_phone}</> }
            </li>
          ))}
        </ul>
      </section>
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
