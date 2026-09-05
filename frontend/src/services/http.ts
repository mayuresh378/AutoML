import type { ApiResponse } from '../types/api';

export const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api/v1';

export const DEFAULT_TIMEOUT_MS = 20_000;

let _tokenGetter: (() => string | null | Promise<string | null>) | null = null;
let _onUnauthorized: (() => void) | null = null;

export function configureHttp(config: {
  tokenGetter: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void;
}) {
  _tokenGetter = config.tokenGetter;
  _onUnauthorized = config.onUnauthorized ?? null;
}

export async function getToken(): Promise<string | null> {
  if (!_tokenGetter) return null;
  try {
    const res = _tokenGetter();
    return res instanceof Promise ? await res : res;
  } catch {
    return null;
  }
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
  if (res.status === 401 && _onUnauthorized) {
    _onUnauthorized();
  }

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

async function buildHeaders(custom?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...custom };
  const token = await getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function timedSignal(externalSignal?: AbortSignal | null): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    },
  };
}

async function request<T = any>(method: string, path: string, body?: any, params?: Record<string, any>, init?: RequestInit & { responseType?: string }): Promise<T> {
  const url = buildUrl(path, params);
  const isFormData = body instanceof FormData;
  const headers = await buildHeaders(init?.headers as Record<string, string>);
  if (!isFormData) {
    if (body != null && method !== 'GET') headers['Content-Type'] = 'application/json';
  } else {
    delete headers['Content-Type'];
  }
  const { signal, clear } = timedSignal(init?.signal);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: isFormData ? body : body && method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    if ((init as any)?.responseType === 'blob') return (await res.blob()) as unknown as T;
    return await handleResponse<T>(res);
  } catch (err) {
    if (isAbortError(err)) {
      const externallyAborted = Boolean(init?.signal?.aborted);
      throw new HttpError(
        0,
        externallyAborted ? 'ABORTED' : 'TIMEOUT',
        externallyAborted
          ? 'Request aborted'
          : `Request timed out after ${Math.round(DEFAULT_TIMEOUT_MS / 1000)}s`,
      );
    }
    throw err;
  } finally {
    clear();
  }
}

export const http = {
  async get<T = any>(path: string, params?: Record<string, any>, init?: RequestInit & { responseType?: string }): Promise<T> {
    return request<T>('GET', path, undefined, params, init);
  },

  async post<T = any>(path: string, body?: any, init?: RequestInit): Promise<T> {
    return request<T>('POST', path, body, undefined, init);
  },

  async put<T = any>(path: string, body?: any, init?: RequestInit): Promise<T> {
    return request<T>('PUT', path, body, undefined, init);
  },

  async patch<T = any>(path: string, body?: any, init?: RequestInit): Promise<T> {
    return request<T>('PATCH', path, body, undefined, init);
  },

  async delete<T = any>(path: string, init?: RequestInit): Promise<T> {
    return request<T>('DELETE', path, undefined, undefined, init);
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
  const url = `${BASE}${path}`;
  return url;
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
