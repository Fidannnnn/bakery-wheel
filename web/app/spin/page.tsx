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

const POINTER_DEG = 180;

const ICONS: Record<string, string> = {
  coffee: "/icons/coffee.png",
  croissant_choco: "/icons/croissant_choco.png",
  coupon_3: "/icons/coupon_3.png",
  cake_15: "/icons/cake_15.png",
  coupon_5: "/icons/coupon_5.png",
  retry: "/icons/retry.png",
  tea_dessert: "/icons/tea_dessert.png",
  fast_food: "/icons/fast_food.png",
  birthday_cake_50: "/icons/birthday_cake_50.png",
  all_50: "/icons/all_50.png",
};

function iconFor(type?: string | null): string | null {
  if (!type) return null;
  return ICONS[type] ?? null;
}

function validateName(name: string) {
  const n = name.trim();
  if (!n || n.length < 2) return { ok: false, reason: "Ad çox qısadır." };
  if (!/^[\p{L} .'-]+$/u.test(n)) return { ok: false, reason: "Yalnız hərf və boşluqlardan istifadə edin." };
  return { ok: true };
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

  function fitLabel(text: string, limit = 12) {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? line + " " + w : w;
      if (next.length > limit && line) { lines.push(line); line = w; }
      else { line = next; }
    }
    if (line) lines.push(line);
    return lines.join("\n");      // we'll render with pre-wrap
  }

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
      const TURNS = 4;           // full extra turns for drama

      const current = norm(wheelAngle);
      const targetStop = norm(POINTER_DEG - mid);
      const rawDelta = norm(targetStop - current);
      const delta = rawDelta < 20 ? rawDelta + 360 : rawDelta; // avoid micro-spin

      setWheelAngle(p => p + TURNS * 360 + delta);
      setTimeout(() => setLoading(false), SPIN_MS + 80);

    } catch (e: any) {
      setError(e.message || "Fırlatmaq mümkün olmadı");
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
      setError("Kopyalama uğursuz oldu — əllə kopyalayın.");
    }
  }

  function fmt(dt?: string | null) {
    if (!dt) return "";
    return new Date(dt).toLocaleString();
  }

  function countdown(to?: string | null) {
    if (!to) return "";
    const ms = new Date(to).getTime() - now;
    if (ms <= 0) return "00:00:00";
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600).toString().padStart(2, "0");
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  const hasActive = result?.status === "new" || result?.status === "existing_active";

  if (!mounted || !haveCreds) return null;

  // build wedges (CSS basis: 0° = right, clockwise)
  const palette = [
    "#FF3B2E", // vivid red
    "#FF7B00", // orange
    "#FFB300", // golden yellow
    "#00BFFF", // bright blue
    "#0096FF", // deep sky blue
    "#6F00FF", // violet
    "#FF00AA", // magenta
    "#00CC66", // green
    "#FFA500", // orange-yellow
    "#FF1493", // hot pink
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
            <h1 style={{ margin: 0, fontSize: 24, color: "#e0a89fff" }}>Ravira Çarxı</h1>
            <small style={{ opacity: .75, color: "#e7c9c3ff" }}>
              Daxil olmusunuz: <b>{fullName}</b> · <a href="/login?next=/spin" style={{ color: "#b24a3b" }}>dəyiş</a>
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
                const iconType = (wedges[idx] as any)?.iconType;
                const src = iconFor(iconType);

                // keep numbers small for smoother CSS
                const wa = ((wheelAngle % 360) + 360) % 360;

                return (
                  <div
                    key={idx}
                    style={{
                      ...labelRing,
                      // rotate the ring so the anchor sits at the slice mid
                      transform: `rotate(${l.mid}deg)`,
                    }}
                  >
                    <div
                      style={{
                        ...labelAtTop,
                        top: "12%",                           // how close to the rim (tweak 10–14)
                        // counter-rotate by slice + wheel so text is always horizontal
                        transform: `translateX(-50%) rotate(${-(l.mid + wa)}deg)`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        willChange: "transform",
                      }}
                      title={labels[idx]?.text ?? "Hədiyyə"}
                    >
                      {src && (
                        <img
                          src={src}
                          alt=""
                          style={{
                            width: 28,
                            height: 28,
                            objectFit: "contain",
                            filter: "drop-shadow(0 1px 1px rgba(0,0,0,.15))",
                            pointerEvents: "none",
                            userSelect: "none",
                            // keep icon horizontal too
                            transform: "rotate(0deg)",
                          }}
                        />
                      )}
                      <span style={{ ...labelChip, whiteSpace: "pre-wrap" }}>
                        {fitLabel(labels[idx]?.text ?? "Hədiyyə", 11)}
                      </span>
                    </div>
                  </div>
                );
              })}


            </div>
            <div style={logoHub}>
              <img
                src="/logo.png"
                alt="Ravira Bakery"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,.25))",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            </div>
          </div>

          <div style={buttonStack}>
            <button
              onClick={spin}
              disabled={loading || hasActive}
              style={{ ...btnPrimary, width: 220, opacity: loading || hasActive ? 0.7 : 1 }}
              title={hasActive ? "Artıq bir kodunuz var" : ""}
            >
              {hasActive ? "Artıq bir kodunuz var" : (loading ? "Fırlanır…" : "Fırlat")}
            </button>

            <button onClick={refreshStatus} style={{ ...btnSecondary, width: 220 }}>
              Statusu yenilə
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
                  <b>Qazandınız:</b> {result.prize_name}
                  {result.prize_value ? <> — <i>{result.prize_value}</i></> : null}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span>Code: <code style={codePill}>{result.code}</code></span>
                  <button onClick={copyCode} style={btnMini} disabled={!result.code}>
                    {copied ? "Kopyalandı!" : "Kopyala"}
                  </button>
                </div>

                <div style={{ opacity: .9 }}>
                  Bitmə tarixi: {fmt(result.expires_at)}
                  {result.expires_at && <> · <b>{countdown(result.expires_at)}</b> qalıb</>}
                </div>
              </div>
            )}

            {result.status === "already_redeemed" && (
              <div style={{ marginTop: 6 }}>
                <div>Istifadə olunma tarixi:<b>{fmt(result.redeemed_at)}</b></div>
                {result.next_spin_at && <div>Növbəti fırlatma: {fmt(result.next_spin_at)} · <b>{countdown(result.next_spin_at)}</b></div>}
              </div>
            )}

            {result.status === "expired" && (
              <div style={{ marginTop: 6 }}>
                <div>Son kodun müddəti bitib: <b>{fmt(result.expires_at)}</b></div>
                {result.next_spin_at && <div>Növbəti fırlatma: {fmt(result.next_spin_at)} · <b>{countdown(result.next_spin_at)}</b></div>}
              </div>
            )}

            {result.status === "cooldown" && result.next_spin_at && (
              <div style={{ marginTop: 6 }}>
                <div>Növbəti fırlatma: {fmt(result.next_spin_at)} · <b>{countdown(result.next_spin_at)}</b></div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}


const wrap: React.CSSProperties = {
  minHeight: "100dvh",
  background: "radial-gradient(circle at center, #0b0d2b 0%, #020316 100%)",
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: "#ffffff", // global text color for readability
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 980,
  borderRadius: 18,
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#f8f8ff", // off-white text for contrast
  boxShadow: "0 10px 40px rgba(255,255,255,0.05)",
  padding: 24,
  display: "grid",
  gap: 18,
};

const head: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  color: "#FFD93B", // golden header text
};

const wheelRow: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "1fr",
  justifyItems: "center",
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

// same % as logoHub width/height
const HUB_PCT = 32; // ← keep in sync with logoHub width/height

const pointer: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: `calc(50% + ${HUB_PCT / 2}% - 4px)`, // sit on the outer edge of the hub
  transform: "translateX(-50%)",
  width: 0,
  height: 0,
  borderLeft: "18px solid transparent",
  borderRight: "18px solid transparent",
  borderTop: "32px solid #FFD93B", // triangle pointing toward the wheel
  filter: "drop-shadow(0 6px 10px rgba(255,215,59,0.3))",
  zIndex: 8,
};


const wheelBase: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  margin: "auto",
  borderRadius: "50%",
  border: "14px solid #ff3b2e",
  boxShadow: "0 0 40px rgba(255,59,46,0.6)",
  zIndex: 0,
};

const hub: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  margin: "auto",
  width: "32%",
  height: "32%",
  borderRadius: "50%",
  background: "#16172a",
  border: "6px solid rgba(255,255,255,0.2)",
  boxShadow: "inset 0 2px 8px rgba(0,0,0,.4)",
  zIndex: 2,
};

const logoHub: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  margin: "auto",
  width: "32%",
  height: "32%",
  borderRadius: "50%",
  background: "radial-gradient(circle at 50% 45%, #fff 0%, #f6f6f6 60%, #e7e7e7 100%)",
  border: "6px solid #d9c5a0",
  boxShadow: "inset 0 2px 6px rgba(0,0,0,.15), 0 3px 10px rgba(0,0,0,.3)",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  zIndex: 5,            // spinLayer ~1, pointer 6 → logo sits between them
};

const resultBox: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.08)",
  padding: 14,
  borderRadius: 14,
  display: "grid",
  gap: 8,
  color: "#fff",
};

const codePill: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.3)",
  fontWeight: 700,
  letterSpacing: 0.2,
  color: "#FFD93B",
};

const btnPrimary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  background: "linear-gradient(180deg,#ff7b00 0%,#ff3b2e 100%)",
  border: "1px solid #ffb300",
  color: "#fff",
  boxShadow: "0 10px 25px rgba(255,59,46,.5)",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  background: "linear-gradient(180deg,#2a2a50 0%,#1a1a2a 100%)",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "#f0f0ff",
  fontWeight: 600,
  cursor: "pointer",
};

const btnMini: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.3)",
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
};

const labelRay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  pointerEvents: "none",
  zIndex: 4,
};

const labelSpot: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "13%",
  transform: "translateX(-50%)",
};

const spinLayer: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
};

const labelRing: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  transformOrigin: "50% 50%",
  zIndex: 3,
};

const labelAtTop: React.CSSProperties = {
  position: "absolute",
  top: "8.5%",                 // a touch farther from the hub (reduces collisions)
  left: "50%",
  transform: "translateX(-50%)",
  width: "34%",                // box width at this radius ≈ one slice chord
  maxWidth: "34%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  pointerEvents: "none",
  color: "#FFD93B",
};

const labelChip: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 6px",
  borderRadius: 10,
  background: "rgba(0,0,0,0.55)",
  border: "1px solid rgba(255,255,255,0.25)",
  color: "#fff",
  fontWeight: 700,
  fontSize: "clamp(10px, 1.25vw, 14px)",  // slightly smaller + responsive
  lineHeight: 1.2,
  textAlign: "center",
  whiteSpace: "normal",        // ← allow wrapping
  wordBreak: "break-word",     // ← break long words
  hyphens: "auto",             // ← let browser hyphenate if possible
  position: "relative",
  zIndex: 5,
};


const labelText: React.CSSProperties = {
  fontWeight: 800,
  fontSize: "clamp(12px, 1.8vw, 18px)",
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: "#fff",
  textShadow: "0 2px 4px rgba(0,0,0,.35)",
  whiteSpace: "nowrap",
};