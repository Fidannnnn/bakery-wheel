// web/app/admin/prizes/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Prize = {
  id?: number;
  name: string;
  type: string;
  value?: string | null;
  weight: number;
  active: boolean;
};

// UI row with a stable key
type PrizeUI = Prize & { uid: string };

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const newUid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function AdminPrizesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<PrizeUI[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("bw_admin_token");
    if (!t) { router.replace("/admin/login?next=/admin/prizes"); return; }
    setToken(t);

    (async () => {
      const r = await fetch(`${API}/api/admin/prizes`, { headers: { Authorization: `Bearer ${t}` } });
      if (r.ok) {
        const data: Prize[] = await r.json();
        // attach a uid for React keys
        setRows(data.map(p => ({ ...p, uid: newUid() })));
      } else if (r.status === 401 || r.status === 403) {
        router.replace("/admin/login?next=/admin/prizes");
      } else {
        setMsg("Failed to load prizes.");
      }
    })();
  }, [router]);

  function addRow() {
    setRows(v => [
      ...v,
      { uid: newUid(), name: "", type: "other", value: "", weight: 0, active: false }, // not auto-selected
    ]);
  }

  // add this near other state
const [busyId, setBusyId] = useState<string | null>(null);

async function removeRow(uid: string) {
  const row = rows.find(r => r.uid === uid);
  if (!row) return;

  // brand-new (no server id) → just remove locally
  if (!row.id) {
    setRows(v => v.filter(r => r.uid !== uid));
    return;
  }

  if (!token) return;
  if (!confirm(`Delete prize "${row.name}"?`)) return;

  try {
    setBusyId(uid);
    const r = await fetch(`${API}/api/admin/prizes/${row.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.detail || "Failed to delete");
    }
    // remove locally
    setRows(v => v.filter(x => x.uid !== uid));
    setMsg("✅ Prize deleted");
  } catch (e: any) {
    setMsg(`❌ ${e.message || "Delete failed"}`);
  } finally {
    setBusyId(null);
  }
}


  function update(uid: string, patch: Partial<Prize>) {
    setRows(v => v.map(r => (r.uid === uid ? { ...r, ...patch } : r)));
  }

  const valid = useMemo(() => {
    if (!rows.length) return false;
    const okPool = rows.some(r => r.active && r.weight > 0 && r.name.trim().length > 0);
    const allFields = rows.every(r =>
      r.name.trim().length > 0 &&
      r.type.trim().length > 0 &&
      Number.isFinite(r.weight) &&
      r.weight >= 0
    );
    return okPool && allFields;
  }, [rows]);

  async function save() {
    if (!token) return;
    setSaving(true); setMsg(null);
    // strip the uid before sending to API
    const payload = {
      prizes: rows.map(({ uid, ...p }) => ({ ...p, value: p.value || null })),
    };
    const r = await fetch(`${API}/api/admin/prizes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.ok) {
      setMsg(`✅ ${data.message}`);
      // reload to sync IDs and re-add uids
      const rr = await fetch(`${API}/api/admin/prizes`, { headers: { Authorization: `Bearer ${token}` } });
      if (rr.ok) {
        const fresh: Prize[] = await rr.json();
        setRows(fresh.map(p => ({ ...p, uid: newUid() })));
      }
    } else {
      setMsg(`❌ ${data.detail || data.message || "Failed to save"}`);
    }
    setSaving(false);
  }

  const totalWeight = rows.reduce((a, r) => a + (r.active ? r.weight : 0), 0);

  return (
    <main style={{display:"grid",gap:16,maxWidth:1000}}>
      <h2>Admin — Set prizes</h2>

      <div style={backRow}>
        <a href="/admin" style={backBtn}>← Back to Admin</a>
      </div>

      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={addRow}>+ Add prize</button>
        <button onClick={save} disabled={!valid || saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
        <span style={{opacity:0.7}}>Total active weight: <b>{totalWeight}</b></span>
      </div>

      {msg && <div style={{color: msg.startsWith("✅") ? "green" : "crimson"}}>{msg}</div>}

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <th style={th}>Active</th>
              <th style={th}>Name</th>
              <th style={th}>Type</th>
              <th style={th}>Value</th>
              <th style={th}>Weight (likelihood)</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.uid}>
                <td style={tdCenter}>
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={e => update(r.uid, { active: e.target.checked })}
                  />
                </td>
                <td style={td}>
                  <input
                    value={r.name}
                    onChange={e => update(r.uid, { name: e.target.value })}
                    placeholder="10% Off / Free Coffee"
                  />
                </td>
                <td style={td}>
                  <input
                    value={r.type}
                    onChange={e => update(r.uid, { type: e.target.value })}
                    placeholder="discount / free_item / other"
                  />
                </td>
                <td style={td}>
                  <input
                    value={r.value ?? ""}
                    onChange={e => update(r.uid, { value: e.target.value })}
                    placeholder="10% / Cappuccino"
                  />
                </td>
                <td style={tdN}>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={Number.isFinite(r.weight) ? r.weight : 0}
                    onChange={e => {
                      const n = parseInt(e.target.value || "0", 10);
                      update(r.uid, { weight: Number.isNaN(n) ? 0 : n });
                    }}
                  />
                </td>
                <td style={td}>
                  <button onClick={() => removeRow(r.uid)} disabled={busyId === r.uid}>
                    {busyId === r.uid ? "Removing…" : "Remove"}
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} style={{padding:12,opacity:0.7}}>
                  No prizes yet. Click “Add prize”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <small style={{opacity:0.7}}>
        The chance of a prize is its <b>weight</b> divided by the sum of weights of all <b>active</b> prizes.
        Set weight 0 to keep a prize defined but never drawn.
      </small>
    </main>
  );
}

const th: React.CSSProperties = { textAlign:"left", padding:"8px 6px", borderBottom:"1px solid #e5e5e5" };
const td: React.CSSProperties = { padding:"6px", borderBottom:"1px solid #f1f1f1" };
const tdCenter: React.CSSProperties = { ...td, textAlign:"center" };
const tdN: React.CSSProperties = { ...td, width:120 };
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
