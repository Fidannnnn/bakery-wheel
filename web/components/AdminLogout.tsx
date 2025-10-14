// web/components/AdminLogout.tsx
'use client';
import { useEffect, useState } from 'react';
export default function AdminLogout() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hasCookie = document.cookie.includes('bw_admin=');
    const hasToken = !!localStorage.getItem('bw_admin_token');
    setShow(hasCookie || hasToken);
  }, []);
  if (!show) return null;
  return (
    <button onClick={() => {
      localStorage.removeItem('bw_admin_token');
      document.cookie = 'bw_admin=; Path=/; Max-Age=0; SameSite=Lax';
      location.href = '/admin/login';
    }}>Log out</button>
  );
}
