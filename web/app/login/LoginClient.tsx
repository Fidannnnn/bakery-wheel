// web/app/login/LoginClient.tsx
'use client';

import type React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { validatePhone, normalizePhone } from '@/lib/validation';

type Check = { ok: boolean; reason?: string };

function validateName(name: string): Check {
  const n = name.trim();
  if (!n) return { ok: false, reason: 'Zəhmət olmasa, tam adınızı daxil edin..' };
  if (n.length < 2) return { ok: false, reason: 'Ad çox qısadır.' };
  if (!/^[\p{L} .'-]+$/u.test(n)) return { ok: false, reason: 'Yalnız hərf və boşluqlardan istifadə edin.' };
  return { ok: true };
}

export default function LoginClient({ next }: { next: string }) {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [touchedName, setTouchedName] = useState(false);
  const [touchedPhone, setTouchedPhone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Prefill from localStorage
  useEffect(() => {
    const n = localStorage.getItem('bw_full_name'); if (n) setFullName(n);
    const p = localStorage.getItem('bw_phone'); if (p) setPhone(p);
  }, []);

  const nV = validateName(fullName);
  const pV = validatePhone(phone);
  const canGo = useMemo(() => nV.ok && pV.ok, [nV.ok, pV.ok]);

  function doLogin() {
    if (!canGo || loading) return;
    setLoading(true);
    try {
      localStorage.setItem('bw_full_name', fullName.trim());
      localStorage.setItem('bw_phone', normalizePhone(phone));
      document.cookie = `bw_user=1; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.push(next || '/spin');
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') doLogin();
  }

  return (
    <div style={wrap}>
      <main style={card} aria-labelledby="login-title">
        <header style={head}>
          <h2 id="login-title" style={{ margin: 0, color: '#1f2937' }}>Xoş gəldiniz</h2>
          <p style={{ margin: 0, color: '#4b5563' }}>Çarxı fırlatmaq üçün daxil olun</p>
        </header>

        <section style={{ display: 'grid', gap: 14 }}>
          <label style={label}>
            <span style={labelText}>Tam ad</span>
            <input
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              onBlur={() => setTouchedName(true)}
              onKeyDown={onKeyDown}
              placeholder="Aysel Məmmədova"
              aria-invalid={touchedName && !nV.ok}
              aria-describedby="name-help"
              style={{ ...input, ...(fullName ? (nV.ok ? inputOk : inputErr) : {}) }}
            />
            <small id="name-help" style={hintText}>Zəhmət olmasa, ad və soyadınızı daxil edin.</small>
            {touchedName && !nV.ok && (<small style={errText}>{nV.reason}</small>)}
          </label>

          <label style={label}>
            <span style={labelText}>Telefon</span>
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
              style={{ ...input, ...(phone ? (pV.ok ? inputOk : inputErr) : {}) }}
            />
            <small id="phone-help" style={hintText}>Ölkə kodunu daxil edin (məsələn, +994…).</small>
            {touchedPhone && !pV.ok && (<small style={errText}>{pV.reason}</small>)}
          </label>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={doLogin}
              disabled={!canGo || loading}
              style={{ ...btnPrimary, opacity: (!canGo || loading) ? 0.8 : 1 }}
              title={!canGo ? 'Hər iki sahəni düzgün doldurun' : ''}
            >
              {loading ? 'Zəhmət olmasa, gözləyin…' : 'Davam et'}
            </button>
            <Link href="/" style={btnGhost as React.CSSProperties}>Geri</Link>
          </div>

          <small style={{ color: '#6b7280' }}>
            Ad və telefon nömrənizi rahatlıq üçün yadda saxlayırıq. Sonradan dəyişə bilərsiniz.
          </small>
        </section>
      </main>
    </div>
  );
}

/* styles (unchanged) */
/* lively gradient background */
const wrap: React.CSSProperties = {
  minHeight: '100dvh',
  background:
    'radial-gradient(1000px 600px at 10% -10%, #ffecd2 0%, rgba(255,255,255,0) 60%),' +
    'radial-gradient(1200px 800px at 120% 20%, #ffe8f0 0%, rgba(255,255,255,0) 55%),' +
    'linear-gradient(180deg, #fffaf3 0%, #fff5e1 100%)',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  color: '#1f1b17',
};

/* card pop effect */
const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 560,
  borderRadius: 18,
  border: '1px solid #ffd9b5',
  background: '#fffdf8',
  boxShadow: '0 12px 40px rgba(255, 102, 0, 0.25)',
  padding: 28,
  display: 'grid',
  gap: 18,
};

/* labels & inputs */
const labelText: React.CSSProperties = {
  fontSize: 14,
  color: '#7a2b15', // warm brown-red
  fontWeight: 600,
};

const hintText: React.CSSProperties = {
  color: '#b85b3e',
  fontSize: 12,
};

const input: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid #ffb688',
  background: '#fff',
  color: '#111',
  outline: 'none',
  transition: 'all .2s ease',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
};
const inputOk: React.CSSProperties = {
  borderColor: '#00c36a',
  boxShadow: '0 0 0 3px rgba(0,195,106,0.2)',
};
const inputErr: React.CSSProperties = {
  borderColor: '#ff3b2e',
  boxShadow: '0 0 0 3px rgba(255,59,46,0.2)',
};

/* buttons */
const btnPrimary: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: 12,
  border: '1px solid #ff5a00',
  background: 'linear-gradient(180deg, #ff7b00 0%, #ff3b2e 100%)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
  boxShadow: '0 10px 24px rgba(255,59,46,0.4)',
  transition: 'transform .15s ease',
};
const btnGhost: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: 12,
  border: '1px solid #ffc9a1',
  background: 'linear-gradient(180deg,#fff8f3 0%,#fff2e5 100%)',
  color: '#a33b25',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  boxShadow: '0 3px 8px rgba(255,138,76,0.15)',
};

const head: React.CSSProperties = { display: 'grid', gap: 6 };
const label: React.CSSProperties = { display: 'grid', gap: 6 };
const errText: React.CSSProperties = { color: '#b91c1c', fontWeight: 600 };
