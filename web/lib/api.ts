// web/lib/api.ts
export async function apiPost<T>(
  path: string,
  body: any,
  opts?: { admin?: boolean }
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // Attach admin JWT if requested
  if (opts?.admin && typeof window !== "undefined") {
    const t = localStorage.getItem("bw_admin_token");
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail || detail?.message || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
