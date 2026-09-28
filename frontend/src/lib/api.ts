// Base URL of the REST API. Empty => same-origin "/api" (proxied by Vite in dev).
const API_URL: string = import.meta.env.VITE_API_URL || '/api';

// ---------------------------------------------------------------- token storage
// The JWT is kept in localStorage so a page refresh keeps the session.
// (Trade-off: readable by scripts on the page; acceptable for this internal app.)
const TOKEN_KEY = 'infra_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

/** Fired when the API answers 401 on a request that carried a token (expired / revoked). */
export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

// ---------------------------------------------------------------- requests
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    if (res.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(res.status, err?.code ?? 'REQUEST_FAILED', err?.message ?? `Request failed (${res.status})`);
  }
  return payload as T;
}

export const apiGet = <T>(path: string): Promise<T> => api<T>(path);
export const apiPost = <T>(path: string, body: unknown): Promise<T> => api<T>(path, { method: 'POST', body });
export const apiPatch = <T>(path: string, body: unknown): Promise<T> => api<T>(path, { method: 'PATCH', body });
export const apiDelete = <T>(path: string): Promise<T> => api<T>(path, { method: 'DELETE' });
