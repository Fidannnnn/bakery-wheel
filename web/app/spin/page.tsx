// web/app/spin/page.tsx
"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { validatePhone, normalizePhone } from "@/lib/validation";

type SpinStatus = "new" | "existing_active" | "already_redeemed" | "expired" | "cooldown" | "none";

type SpinResponse = {
  status: SpinStatus;
  message: string;
  prize_name?: string | null;
  prize_type?: string | null;
  prize_value?: string | null;
  code?: string | null;
  expires_at?: string | null;
  redeemed_at?: string | null;
  next_spin_at?: string | null;
};

type Prize = { id: number; name: string; value?: string | null; weight: number };

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Wedge = { id?: number; name: string; start: number; end: number; mid: number };

const norm = (x: number) => ((x % 360) + 360) % 360;

const POINTER_DEG = 270;

const ICONS: Record<string, string> = {
  donut: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><radialGradient id="g" cx="50%" cy="50%"><stop offset="0%" stop-color="#fff4e6"/><stop offset="100%" stop-color="#ffd4c7"/></radialGradient></defs><circle cx="20" cy="20" r="18" fill="url(#g)" stroke="#e9b8a7" stroke-width="2"/><circle cx="20" cy="20" r="7" fill="#fffaf3" stroke="#f0d6cb" stroke-width="2"/></svg>`),
  coffee: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="8" y="12" width="24" height="16" rx="4" fill="#8B5E3C"/><rect x="6" y="10" width="28" height="4" rx="2" fill="#C9B29A"/><rect x="12" y="14" width="16" height="10" rx="2" fill="#FFF8F2"/></svg>`),
  croissant: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M8 22c6-8 18-8 24 0-6 6-18 6-24 0z" fill="#F5C27A" stroke="#D7A45F"/></svg>`),
  cake: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="8" y="18" width="24" height="10" rx="2" fill="#FFD1DC"/><rect x="8" y="14" width="24" height="6" rx="2" fill="#FFF"/><circle cx="20" cy="14" r="3" fill="#FF8FA3"/></svg>`),
  cookie: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#E5B77A"/><circle cx="14" cy="16" r="2" fill="#6B4F3A"/><circle cx="26" cy="18" r="2" fill="#6B4F3A"/><circle cx="18" cy="24" r="2" fill="#6B4F3A"/></svg>`),
  percent: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><line x1="10" y1="30" x2="30" y2="10" stroke="#b24a3b" stroke-width="3"/><circle cx="14" cy="14" r="4" fill="#ffd7cf"/><circle cx="26" cy="26" r="4" fill="#ffd7cf"/></svg>`),
  gift: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="8" y="16" width="24" height="18" rx="3" fill="#FFC7D1"/><rect x="18" y="16" width="4" height="18" fill="#E76A5A"/><rect x="8" y="20" width="24" height="4" fill="#E76A5A"/></svg>`),
  star: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M20 6l4.2 8.5 9.3 1.3-6.7 6.5 1.6 9.2L20 27.5 11.6 31.5l1.6-9.2-6.7-6.5 9.3-1.3z" fill="#F6C948"/></svg>`),
};

function iconFor(type?: string | null): string | null {
  if (!type) return null;
  return ICONS[type] ?? null;
}



function validateName(name: string) {
  const n = name.trim();
  if (!n || n.length < 2) return { ok: false, reason: "Name looks too short." };
  if (!/^[\p{L} .'-]+$/u.test(n)) return { ok: false, reason: "Use letters/spaces only." };
  return { ok: true };
}

function angleForMid(mid: number, currentAngle: number) {
  const current = norm(currentAngle);
  const baseTarget = norm(POINTER_DEG - mid);  // mid + A ≡ 270
  let delta = norm(baseTarget - current);      // shortest positive move
  // ensure it doesn't look like a micro-spin
  if (delta < 30) delta += 360;
  const turns = 360 * 5;                       // visual extra spins
  return currentAngle + turns + delta;
}

export default function Page() {
  const router = useRouter();

  // ---- fixed-order hooks ----
  const [mounted, setMounted] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  const [result, setResult] = useState<SpinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [now, setNow] = useState<number>(Date.now());
  const tickRef = useRef<number | null>(null);

  // wheel state
  const [wheelAngle, setWheelAngle] = useState(0);
  const [prizes, setPrizes] = useState<Prize[]>([]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    setFullName(localStorage.getItem("bw_full_name"));
    setPhone(localStorage.getItem("bw_phone"));
  }, []);
  // 1-second ticker for countdowns
  useEffect(() => {
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000) as unknown as number;
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const haveCreds = useMemo(() => {
    if (!fullName || !phone) return false;
    return validateName(fullName).ok && validatePhone(phone).ok;
  }, [fullName, phone]);

  // require login

  // load active prizes for labels/wedges
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/prizes`);
        if (r.ok) {
          const data: Prize[] = await r.json();
          const active = data.filter(p => (p.weight ?? 0) >= 0); // keep defined rows; zeros will be tiny/none
          setPrizes(active.length ? active : []);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // preload current status
  useEffect(() => { if (mounted && haveCreds) { refreshStatus(); } }, [mounted, haveCreds, fullName, phone]);

  async function refreshStatus() {
    if (!phone) return;
    try {
      const r = await apiPost<SpinResponse>("/api/status", {
        phone: normalizePhone(phone),
        device_hash: deviceId(true),
      });
      setResult(r);
    } catch { /* ignore */ }
  }

  // helpers
  function deviceId(silent = false) {
    const key = "bw_device_id";
    let v = localStorage.getItem(key);
    if (!v) { v = crypto.randomUUID(); localStorage.setItem(key, v); if (!silent) console.log("device id set"); }
    return v;
  }


  async function spin() {
    if (!haveCreds) return router.push("/login?next=/spin");
    setError(null);
    setResult(null);
    setCopied(false);

    const SPIN_MS = 3200;
    setLoading(true); // enables the long CSS transition

    try {
      // 1) Ask server which prize we got
      const r = await apiPost<SpinResponse>("/api/spin", {
        full_name: fullName!,
        phone: normalizePhone(phone!),
        device_hash: deviceId(),
      });
      setResult(r);

      // 2) Server tells us the exact wedge index
      const k = (r as any).wedge_index as number | undefined;
      const count = (r as any).wedges_count as number | undefined;

      const n = count && count > 0 ? count : wedges.length;
      if (typeof k !== "number" || n <= 0) {
        // graceful fallback so the user still sees movement
        setWheelAngle(p => p + 360);
        setTimeout(() => { setLoading(false); }, SPIN_MS);
        return;
      }

      // 3) Rotate so the center of slice k aligns with the pointer
      const slice = 360 / n;
      const mid = k * slice + slice / 2;

      // pick where your pointer lives: top = 270°, bottom = 180°
      const POINTER_DEG = 180;   // ← set to 180 if you want the pointer at bottom
      const TURNS = 6;           // full extra turns for drama

      const current = norm(wheelAngle);
      const targetStop = norm(POINTER_DEG - mid);
      const rawDelta = norm(targetStop - current);
      const delta = rawDelta < 20 ? rawDelta + 360 : rawDelta; // avoid micro-spin

      setWheelAngle(p => p + TURNS * 360 + delta);
      setTimeout(() => setLoading(false), SPIN_MS + 80);

    } catch (e: any) {
      setError(e.message || "Failed to spin");
      setLoading(false);
    }
  }


  async function copyCode() {
    if (!result?.code) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Couldn't copy — copy it manually.");
    }
  }

  function fmt(dt?: string | null) {
    if (!dt) return "";
    return new Date(dt).toLocaleString();
  }

  function countdown(to?: string | null) {
    if (!to) return "";
    const ms = new Date(to).getTime() - now;
    if (ms <= 0) return "expired";
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600).toString().padStart(2, "0");
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  const hasActive = result?.status === "new" || result?.status === "existing_active";

  if (!mounted || !haveCreds) return null;

  // build wedges (CSS basis: 0° = right, clockwise)
  const palette = ["#ffd1c1", "#ffe6a7", "#c2e8ce", "#d8d3ff", "#ffc2cc", "#fbe0a0", "#c7efd8", "#e3ddff", "#ffd8cd", "#f7edc9"];
  const BAKERY_PALETTE = [
    "#F8D8C6", // soft peach
    "#F9E5B9", // warm vanilla
    "#CDE8D5", // mint cream
    "#E4DAFF", // lilac glaze
    "#FFC7D1", // strawberry frosting
    "#FBE4B7", // honey butter
    "#D3F0E3", // pistachio cream
    "#EDE6FF", // lavender sugar
  ];

  let gradient = "";
  let labels: Array<{ text: string; mid: number }> = [];
  let wedges: Array<{ id?: number; name: string; start: number; end: number; mid: number }> = [];

  // ── equal wedges: one prize per slice (order == /api/prizes) ───────────────
  const n = prizes.length || 8;             // fallback to 8 placeholders if none yet
  const seg = 360 / n;
  let at = 0;
  const segs: string[] = [];

  for (let i = 0; i < n; i++) {
    const end = at + seg;
    const mid = at + seg / 2;
    const color = palette[i % palette.length];
    const id = prizes[i]?.id;
    const iconType = (prizes[i] as any)?.icon_type || null;
    const name = prizes[i]?.name ?? "Prize";

    segs.push(`${color} ${at}deg ${end}deg`);
    labels.push({ text: name, mid });
    wedges.push({ id, name, start: at, end, mid, iconType } as any);

    at = end;
  }
  gradient = `conic-gradient(from 0deg, ${segs.join(",")})`;

  // ---- UI ----
  return (
    <div style={wrap}>
      <main style={card}>
        <header style={head}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: "#4a2e2a" }}>Bakery Wheel</h1>
            <small style={{ opacity: .75, color: "#6b4a43" }}>
              Logged in as <b>{fullName}</b> · <a href="/login?next=/spin" style={{ color: "#b24a3b" }}>change</a>
            </small>
          </div>
        </header>

        {/* Wheel area */}
        <section style={wheelRow}>
          <div style={wheelWrap}>
            <div style={pointer} aria-hidden />

            {/* everything that should spin goes inside this layer */}
            <div
              style={{
                ...spinLayer,
                transform: `rotate(${wheelAngle}deg)`,
                transition: loading
                  ? "transform 3.2s cubic-bezier(.17,.67,.13,1.02)"
                  : "transform 0.6s ease",
              }}
            >
              <div style={{ ...wheelBase, background: gradient }} />

              {/* labels/icons, attached to slices via full-size ring */}
              {labels.map((l, idx) => {
                const innerRotate = 90; // vertical orientation
                const iconType = (wedges[idx] as any)?.iconType;
                const src = iconFor(iconType); // <— define here

                return (
                  <div
                    key={idx}
                    style={{
                      ...labelRing,
                      transform: `rotate(${l.mid}deg)`,
                    }}
                  >
                    <div
                      style={{
                        ...labelAtTop,
                        transform: `translateX(-50%) rotate(${innerRotate}deg)`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={labels[idx]?.text ?? "Hədiyyə"}
                    >
                      {src && (
                        <img
                          src={src}
                          alt=""
                          style={{
                            width: 36,
                            height: 36,
                            objectFit: "contain",
                            marginBottom: 6,
                            filter: "drop-shadow(0 1px 1px rgba(0,0,0,.15))",
                            pointerEvents: "none",
                            userSelect: "none",
                          }}
                        />
                      )}
                      <span style={labelChip}>{labels[idx]?.text ?? "Hədiyyə"}</span>
                    </div>
                  </div>
                );
              })}

              <div style={hub} />
            </div>
          </div>

          <div style={buttonStack}>
            <button
              onClick={spin}
              disabled={loading || hasActive}
              style={{ ...btnPrimary, width: 220, opacity: loading || hasActive ? 0.7 : 1 }}
              title={hasActive ? "You already have a code" : ""}
            >
              {hasActive ? "You already have a code" : (loading ? "Spinning…" : "Spin")}
            </button>

            <button onClick={refreshStatus} style={{ ...btnSecondary, width: 220 }}>
              Refresh status
            </button>

            {error && (
              <div role="alert" style={{ color: "#b24a3b", fontWeight: 600, marginTop: 6 }}>
                {error}
              </div>
            )}
          </div>

        </section>

        {/* Result card */}
        {result && (
          <section aria-live="polite" style={resultBox}>
            <div style={{
              color:
                hasActive ? "#2e7d32" :
                  result.status === "cooldown" ? "#ff8f00" :
                    "#b24a3b",
              fontWeight: 700
            }}>
              {result.message}
            </div>

            {(result.status === "new" || result.status === "existing_active") && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 16 }}>
                  <b>You won:</b> {result.prize_name}
                  {result.prize_value ? <> — <i>{result.prize_value}</i></> : null}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span>Code: <code style={codePill}>{result.code}</code></span>
                  <button onClick={copyCode} style={btnMini} disabled={!result.code}>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>

                <div style={{ opacity: .9 }}>
                  Expires: {fmt(result.expires_at)}
                  {result.expires_at && <> · <b>{countdown(result.expires_at)}</b> left</>}
                </div>
              </div>
            )}

            {result.status === "already_redeemed" && (
              <div style={{ marginTop: 6 }}>
                <div>Last redeemed at: <b>{fmt(result.redeemed_at)}</b></div>
                {result.next_spin_at && <div>Next spin: {fmt(result.next_spin_at)} · <b>{countdown(result.next_spin_at)}</b></div>}
              </div>
            )}

            {result.status === "expired" && (
              <div style={{ marginTop: 6 }}>
                <div>Last code expired: <b>{fmt(result.expires_at)}</b></div>
                {result.next_spin_at && <div>Next spin: {fmt(result.next_spin_at)} · <b>{countdown(result.next_spin_at)}</b></div>}
              </div>
            )}

            {result.status === "cooldown" && result.next_spin_at && (
              <div style={{ marginTop: 6 }}>
                <div>Next spin: {fmt(result.next_spin_at)} · <b>{countdown(result.next_spin_at)}</b></div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/* ---------- theme styles (warm bakery palette) ---------- */

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
  maxWidth: 980,
  borderRadius: 18,
  border: "1px solid #f1e1cf",
  background: "#fffaf3",
  boxShadow: "0 10px 40px rgba(119,72,57,.12)",
  padding: 24,
  display: "grid",
  gap: 18,
};

const head: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
};

const wheelRow: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "1fr",   // one column
  justifyItems: "center",       // center wheel & buttons
  alignItems: "center",
};

const buttonStack: React.CSSProperties = {
  display: "grid",
  gap: 10,
  justifyItems: "center",
  marginTop: 6,
};


const wheelWrap: React.CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "1 / 1",
  overflow: "visible",
};

const pointer: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: "-22px",                 // sit just outside the rim
  transform: "translateX(-50%)",
  width: 0,
  height: 0,
  borderLeft: "18px solid transparent",
  borderRight: "18px solid transparent",
  borderBottom: "28px solid #b24a3b", // arrow color
  filter: "drop-shadow(0 6px 10px rgba(0,0,0,.18))",
  zIndex: 6,                    // on top of everything
};

const wheelBase: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  margin: "auto",
  borderRadius: "50%",
  border: "12px solid #f3dfcc",
  boxShadow: "inset 0 0 60px rgba(0,0,0,.06), 0 20px 40px rgba(0,0,0,.12)",
  zIndex: 0,
};

const hub: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  margin: "auto",
  width: "28%",
  height: "28%",
  borderRadius: "50%",
  background: "#fff7f2",
  border: "6px solid #f3dfcc",
  boxShadow: "inset 0 2px 4px rgba(0,0,0,.08)",
  zIndex: 2,
};

const labelBase: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transformOrigin: "50% 50%",
  textAlign: "center",
  pointerEvents: "none",
  userSelect: "none",
  zIndex: 3,                    // labels above wheel, below pointer
};

const labelChip: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(0,0,0,0.08)",
  color: "#2b140f",
  fontWeight: 700,
  fontSize: "clamp(11px, 1.5vw, 13px)",
  lineHeight: 1.15,
  textAlign: "center",
  whiteSpace: "normal",
  wordBreak: "break-word",
  position: "relative",
  zIndex: 5,
};


const ctaCol: React.CSSProperties = {
  display: "grid",
  gap: 12,
  alignContent: "start",
};

const resultBox: React.CSSProperties = {
  border: "1px solid #f1e1cf",
  background: "#fffdf8",
  padding: 14,
  borderRadius: 14,
  display: "grid",
  gap: 8,
};

const codePill: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 10,
  background: "#fff3ea",
  border: "1px solid #f1d3c9",
  fontWeight: 700,
  letterSpacing: 0.2,
  color: "#5a352f",
};

const btnPrimary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  border: "1px solid #b24a3b",
  background: "linear-gradient(180deg, #ff8f7e, #e76a5a)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(178,74,59,.25)",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #e8d7c4",
  background: "#fff9f1",
  color: "#6b4a43",
  fontWeight: 600,
  cursor: "pointer",
};

const btnMini: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #e8d7c4",
  background: "#fff9f1",
  color: "#6b4a43",
  cursor: "pointer",
  fontSize: 13,
};

const labelRay: React.CSSProperties = {
  position: "absolute",
  inset: 0,                    // full wheel size
  borderRadius: "50%",
  pointerEvents: "none",
  zIndex: 4,
};

const labelSpot: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "13%",                  // distance from rim (8–14% works well)
  transform: "translateX(-50%)",
};

const spinLayer: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
};

// Full-size layer we rotate to the slice angle.
const labelRing: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  transformOrigin: "50% 50%",
  zIndex: 3,
};

// The “anchor” at the top of the wheel; % here is relative to the WHEEL size.
const labelAtTop: React.CSSProperties = {
  position: "absolute",
  top: "9%",           // distance from rim → adjust 6–12% to taste
  left: "50%",
  transform: "translateX(-50%)",
  display: "grid",
  placeItems: "center",
};
