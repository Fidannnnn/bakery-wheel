type ApiOptions = {
  admin?: boolean;
  token?: string;
  method?: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE';
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
};

function withQuery(path: string, query?: ApiOptions['query']) {
  const url = path.startsWith('/') ? path : `/${path}`;
  if (!query) return url;
  const qs = new URLSearchParams(Object.entries(query).reduce((acc, [k, v]) => {
    if (v !== undefined && v !== null) acc[k] = String(v);
    return acc;
  }, {} as Record<string, string>)).toString();
  return qs ? `${url}?${qs}` : url;
}

function getAdminToken(opts?: ApiOptions) {
  if (opts?.token) return opts.token;
  if (typeof window !== 'undefined') return localStorage.getItem('bw_admin_token');
  return null;
}

async function apiFetch<T>(path: string, body?: unknown, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? (body === undefined ? 'GET' : 'POST');
  const url = withQuery(path, opts.query); // NOTE: relative path like "/api/spin"

  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (opts.admin) {
    const token = getAdminToken(opts);
    if (!token) throw new Error('Missing admin token. Please login again.');
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    try {
      const j = text ? JSON.parse(text) as { detail?: string; message?: string } : {};
      throw new Error(j.detail || j.message || `Request failed: ${res.status}`);
    } catch {
      throw new Error(text || `Request failed: ${res.status}`);
    }
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T,>(path: string, opts: ApiOptions = {}) => apiFetch<T>(path, undefined, { ...opts, method: 'GET' });
export const apiPost = <T,>(path: string, body?: unknown, opts: ApiOptions = {}) => apiFetch<T>(path, body, { ...opts, method: 'POST' });
