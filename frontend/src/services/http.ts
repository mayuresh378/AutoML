import type { ApiResponse } from '../types/api';

export const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api/v1';

let _tokenGetter: (() => string | null) | null = null;
let _onUnauthorized: (() => void) | null = null;

export function configureHttp(config: {
  tokenGetter: () => string | null;
  onUnauthorized?: () => void;
}) {
  _tokenGetter = config.tokenGetter;
  _onUnauthorized = config.onUnauthorized ?? null;
}

function getToken(): string | null {
  return _tokenGetter ? _tokenGetter() : null;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: string,
    public field?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}

export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (isHttpError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: any;
    try {
      body = await res.json();
    } catch {
      throw new HttpError(res.status, 'UNKNOWN_ERROR', res.statusText || `Request failed (${res.status})`);
    }
    const errData = body?.error || body;
    throw new HttpError(
      res.status,
      errData.code || 'REQUEST_ERROR',
      errData.details || errData.message || body.detail || `Request failed (${res.status})`,
      errData.details,
      errData.field,
    );
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  return body as T;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  let url = `${BASE}${path}`;
  if (params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') search.set(k, String(v));
    }
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

function buildHeaders(custom?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...custom };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const http = {
  async get<T = any>(path: string, params?: Record<string, any>, init?: RequestInit): Promise<T> {
    const url = buildUrl(path, params);
    const res = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(init?.headers as Record<string, string>),
      signal: init?.signal,
    });
    return handleResponse<T>(res);
  },

  async post<T = any>(path: string, body?: any, init?: RequestInit): Promise<T> {
    const url = buildUrl(path);
    const isFormData = body instanceof FormData;
    const headers = buildHeaders(init?.headers as Record<string, string>);
    if (isFormData) delete headers['Content-Type'];
    else if (body != null) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      signal: init?.signal,
    });
    return handleResponse<T>(res);
  },

  async put<T = any>(path: string, body?: any, init?: RequestInit): Promise<T> {
    const url = buildUrl(path);
    const isFormData = body instanceof FormData;
    const headers = buildHeaders(init?.headers as Record<string, string>);
    if (isFormData) delete headers['Content-Type'];
    else if (body != null) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      signal: init?.signal,
    });
    return handleResponse<T>(res);
  },

  async patch<T = any>(path: string, body?: any, init?: RequestInit): Promise<T> {
    const url = buildUrl(path);
    const isFormData = body instanceof FormData;
    const headers = buildHeaders(init?.headers as Record<string, string>);
    if (isFormData) delete headers['Content-Type'];
    else if (body != null) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      signal: init?.signal,
    });
    return handleResponse<T>(res);
  },

  async delete<T = any>(path: string, init?: RequestInit): Promise<T> {
    const url = buildUrl(path);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: buildHeaders(init?.headers as Record<string, string>),
      signal: init?.signal,
    });
    return handleResponse<T>(res);
  },

  async upload<T = any>(path: string, file: File, fieldName = 'file', extraFields?: Record<string, string>): Promise<T> {
    const form = new FormData();
    form.append(fieldName, file);
    if (extraFields) {
      for (const [k, v] of Object.entries(extraFields)) {
        form.append(k, v);
      }
    }
    return http.post<T>(path, form);
  },

  buildUrl(path: string, params?: Record<string, any>): string {
    return buildUrl(path, params);
  },
};

export function downloadUrl(path: string): string {
  const token = getToken();
  const url = `${BASE}${path}`;
  if (!token) return url;
  const sep = path.includes('?') ? '&' : '?';
  return `${url}${sep}token=${token}`;
}

export function downloadBlob(data: Record<string, any>[], filename: string) {
  const header = Object.keys(data[0] || {});
  const csv = [header.join(','), ...data.map(r => header.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
