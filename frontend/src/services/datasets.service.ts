import { http } from './http';
import type { Dataset, DatasetPreview, DatasetProfile, DatasetAnalysisResult } from '../types/api';

function inferDtype(col: string, rows: Record<string, any>[]): string {
  for (const row of rows) {
    const v = row[col];
    if (v == null || v === '') continue;
    if (typeof v === 'number') return Number.isInteger(v) ? 'int64' : 'float64';
    if (typeof v === 'boolean') return 'bool';
    const s = String(v);
    if (!Number.isNaN(Number(s))) return s.includes('.') ? 'float64' : 'int64';
    if (!Number.isNaN(Date.parse(s))) return 'datetime64[ns]';
    return 'object';
  }
  return 'object';
}

export const datasetsService = {
  list: () => http.get<{ datasets: Dataset[] }>('/datasets'),

  loadSample: (sampleName: string) =>
    http.post<{ name: string; sample_key: string; description: string; default_target: string; rows: number; columns: string[]; size_kb: number; id: string; status: string }>(
      `/datasets/sample/${encodeURIComponent(sampleName)}`
    ),

  get: (name: string) => http.get<Dataset>(`/datasets/${encodeURIComponent(name)}`),

  upload: (file: File) => http.upload<Dataset>('/datasets', file),

  preview: async (name: string, rows = 50, offset = 0): Promise<DatasetPreview> => {
    const res = await http.get<any>(`/datasets/${encodeURIComponent(name)}/preview`, { rows, offset });
    const columns: string[] = res?.columns || [];
    const data: Record<string, any>[] = res?.data || [];
    const dtypes: Record<string, string> = {};
    for (const col of columns) dtypes[col] = inferDtype(col, data);
    return { columns, rows: data, total: res?.total_rows || 0, dtypes };
  },

  profile: (name: string) =>
    http.get<DatasetProfile>(`/datasets/${encodeURIComponent(name)}/profile`),

  remove: (name: string) =>
    http.delete(`/datasets/${encodeURIComponent(name)}`),

  clean: (name: string, operations: any[]) => {
    const form = new FormData();
    form.append('operations', JSON.stringify(operations));
    return http.post<Dataset>(`/datasets/${encodeURIComponent(name)}/clean`, form);
  },

  autoClean: (name: string) =>
    http.post<Dataset>(`/datasets/${encodeURIComponent(name)}/auto-clean`),

  analyze: (name: string, target?: string) =>
    http.get<DatasetAnalysisResult>(`/datasets/${encodeURIComponent(name)}/analyze`, target ? { target } : undefined),

  suggestFeatures: (name: string) =>
    http.get<{ suggestions: any[] }>(`/datasets/${encodeURIComponent(name)}/features/suggest`),

  generateFeatures: (name: string, operations: any[]) => {
    const form = new FormData();
    form.append('operations', JSON.stringify(operations));
    return http.post<Dataset>(`/datasets/${encodeURIComponent(name)}/features/generate`, form);
  },

  updateTags: (name: string, tags: string[]) => {
    const form = new FormData();
    form.append('tags', JSON.stringify(tags));
    return http.put(`/datasets/${encodeURIComponent(name)}/tags`, form);
  },

  updateDescription: (name: string, description: string) => {
    const form = new FormData();
    form.append('description', description);
    return http.put(`/datasets/${encodeURIComponent(name)}/description`, form);
  },

  importFromUrl: (url: string, name?: string) => {
    const form = new FormData();
    form.append('url', url);
    if (name) form.append('name', name);
    return http.post<{ filename: string; rows: number; id: string }>('/datasets/import-url', form);
  },

  importFromDatabase: (connectionString: string, query: string, name?: string) => {
    const form = new FormData();
    form.append('connection_string', connectionString);
    form.append('query', query);
    if (name) form.append('name', name);
    return http.post<{ filename: string; rows: number; id: string }>('/datasets/import-database', form);
  },

  share: (name: string, email: string, permission = 'view') => {
    const form = new FormData();
    form.append('email', email);
    form.append('permission', permission);
    return http.post(`/datasets/${encodeURIComponent(name)}/share`, form);
  },

  listShares: (name: string) =>
    http.get<{ id: string; email: string; permission: string; created_at: string }[]>(
      `/datasets/${encodeURIComponent(name)}/shares`
    ),

  removeShare: (name: string, shareId: string) =>
    http.delete(`/datasets/${encodeURIComponent(name)}/shares/${shareId}`),
};
