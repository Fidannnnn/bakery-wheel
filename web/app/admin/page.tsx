// web/app/admin/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminHome() {
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("bw_admin_token");
    if (!t) router.replace("/admin/login?next=/admin");
  }, [router]);

  return (
    <main style={{display:"grid",gap:16,maxWidth:520}}>
      <h2>Admin</h2>
      <div style={{display:"flex",gap:12}}>
        <a href="/admin/redeem"><button>Redeem</button></a>
        <a href="/admin/analytics"><button>Analytics</button></a>
        <a href="/admin/prizes"><button>Set prizes</button></a>
      </div>
      <div>
        <button
          onClick={()=>{
            localStorage.removeItem("bw_admin_token");
            location.href="/admin/login";
          }}
        >Log out</button>
      </div>
    </main>
  );
}
