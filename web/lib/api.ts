type ApiOptions = {
  admin?: boolean;
  token?: string;
  method?: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE';
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
};

function getBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw && raw.trim()) return raw.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing NEXT_PUBLIC_API_URL in production');
  }
  return 'http://localhost:8000';
}

function withQuery(path: string, query?: ApiOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function getAdminToken(opts?: ApiOptions): string | null {
  if (opts?.token) return opts.token;
  if (typeof window !== 'undefined') return localStorage.getItem('bw_admin_token');
  return null;
}

async function apiFetch<T>(path: string, body?: unknown, opts: ApiOptions = {}): Promise<T> {
  const base = getBase();
  const method = opts.method ?? (body === undefined ? 'GET' : 'POST');
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${withQuery(safePath, opts.query)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers ?? {}),
  };

  if (opts.admin) {
    const token = getAdminToken(opts);
    if (!token) throw new Error('Missing admin token. Please login again.');
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    try {
      const json = text ? (JSON.parse(text) as { detail?: string; message?: string }) : {};
      throw new Error(json.detail || json.message || `Request failed: ${res.status}`);
    } catch {
      throw new Error(text || `Request failed: ${res.status}`);
    }
  }

  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export function apiGet<T>(path: string, opts: ApiOptions = {}) {
  return apiFetch<T>(path, undefined, { ...opts, method: 'GET' });
}
export function apiPost<T>(path: string, body?: unknown, opts: ApiOptions = {}) {
  return apiFetch<T>(path, body, { ...opts, method: 'POST' });
}
