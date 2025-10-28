// web/app/admin/login/AdminLoginClient.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiPost } from '@/lib/api';

export default function AdminLoginClient({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    setErr(null); setLoading(true);
    try {
      const { token } = await apiPost<{ token: string }>('/api/admin/login', { password });
      localStorage.setItem('bw_admin_token', token);
      router.push(next || '/admin');
    } catch (e: any) {
      setErr(e.message || 'Giriş uğursuz oldu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{display:'grid',gap:12,maxWidth:420}}>
      <h2>Admin — Giriş</h2>
      <input
        type="password"
        placeholder="Admin parolu"
        value={password}
        onChange={e=>setPassword(e.target.value)}
      />
      <button onClick={login} disabled={!password.trim() || loading}>
        {loading ? 'Zəhmət olmasa, gözləyin...' : 'Daxil ol'}
      </button>
      {err && <div style={{color:'crimson'}}>{err}</div>}
    </main>
  );
}
