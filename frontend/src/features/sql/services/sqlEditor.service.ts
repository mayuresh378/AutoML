import { http, downloadBlob, saveBlob } from '../../../services/http';
import {
  QueryResult, QueryHistoryItem, SavedQuery, QueryProfile, QueryPlan,
  ResultToDatasetResponse, TablePreviewResult, RunQueryOptions, SchemaResponse,
  ValidatorResponse, AiSqlResponse, toLocalHistory, toLocalSaved,
} from '../types';

const RUN_TIMEOUT_MS = 75_000;
const STORAGE_KEYS = {
  favorites: 'sql-history-favorites',
};

function loadFavorites(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || '{}');
  } catch { return {}; }
}

function saveFavorites(favs: Record<string, boolean>) {
  try { localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favs)); } catch {}
}

function runForm(query: string, dataset?: string, confirmDestructive = false, extra?: Record<string, string>) {
  const form = new FormData();
  form.append('query', query);
  if (dataset) form.append('dataset', dataset);
  if (confirmDestructive) form.append('confirm_destructive', 'true');
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && v !== '') form.append(k, v);
    }
  }
  return form;
}

export const sqlService = {
  async executeQuery(query: string, dataset?: string, opts?: RunQueryOptions): Promise<QueryResult> {
    const form = runForm(query, dataset, opts?.confirmDestructive, {
      ...(opts?.clientId ? { client_id: opts.clientId } : {}),
      ...(opts?.page && opts.page > 1 ? { page: String(opts.page) } : {}),
      ...(opts?.pageSize ? { page_size: String(opts.pageSize) } : {}),
    });
    const start = performance.now();
    const data = await http.post<QueryResult>('/query', form, { timeoutMs: RUN_TIMEOUT_MS, signal: opts?.signal });
    const elapsed = Math.round(performance.now() - start);
    return { ...data, executionTime: data.execution_time_ms ?? elapsed };
  },

  async cancelQuery(queryId: string): Promise<{ status: string; message?: string }> {
    return http.post(`/query/${queryId}/cancel`, undefined, { timeoutMs: 15_000 });
  },

  async cancelQueryByClient(clientId: string): Promise<{ status: string; message?: string }> {
    return http.post(`/query/cancel/client/${encodeURIComponent(clientId)}`, undefined, { timeoutMs: 15_000 });
  },

  async fetchResult(queryId: string, page = 1, pageSize = 50): Promise<QueryResult> {
    return http.get(`/query/${queryId}`, { page, page_size: pageSize });
  },

  async fetchResultPage(queryId: string, page = 1, pageSize = 50): Promise<QueryResult> {
    return http.get(`/query/${queryId}/page`, { page, page_size: pageSize });
  },

  async listHistory(): Promise<QueryHistoryItem[]> {
    const favs = loadFavorites();
    const data = await http.get<{ history: any[] }>('/query/history', { limit: 200 });
    return (data.history || []).map((h) => toLocalHistory({
      ...h,
      favorite: Boolean(favs[h.id]),
      pinned: false,
    }));
  },

  async updateHistory(id: string, updates: Partial<QueryHistoryItem>) {
    if (updates.favorite !== undefined) {
      const favs = loadFavorites();
      favs[id] = Boolean(updates.favorite);
      saveFavorites(favs);
    }
  },

  async deleteHistoryItem(id: string) {
    await http.delete(`/query/history/${id}`);
    const favs = loadFavorites();
    delete favs[id];
    saveFavorites(favs);
  },

  async clearHistoryAll() {
    await http.delete('/query/history');
  },

  async listSaved(): Promise<SavedQuery[]> {
    const data = await http.get<{ saved: any[] }>('/query/saved');
    return (data.saved || []).map((s) => toLocalSaved(s));
  },

  async saveQuery(payload: { name: string; query: string; dataset?: string | null; folder?: string; tags?: string[]; pinned?: boolean; description?: string }): Promise<{ id: string }> {
    const form = new FormData();
    form.append('name', payload.name);
    form.append('query', payload.query);
    if (payload.dataset) form.append('dataset', payload.dataset);
    if (payload.description) form.append('description', payload.description);
    if (payload.folder) form.append('folder', payload.folder);
    if (payload.tags && payload.tags.length > 0) form.append('tags', JSON.stringify(payload.tags));
    if (payload.pinned) form.append('pinned', 'true');
    return http.post('/query/saved', form);
  },

  async updateSavedQuery(id: string, updates: Partial<SavedQuery>) {
    const form = new FormData();
    if (updates.name !== undefined) form.append('name', updates.name);
    if (updates.query !== undefined) form.append('query', updates.query);
    if (updates.dataset !== undefined) form.append('dataset', updates.dataset ?? '');
    if (updates.folder !== undefined) form.append('folder', updates.folder);
    if (updates.tags !== undefined) form.append('tags', JSON.stringify(updates.tags));
    if (updates.pinned !== undefined) form.append('pinned', String(updates.pinned));
    return http.put(`/query/saved/${id}`, form);
  },

  async deleteSavedQuery(id: string) {
    await http.delete(`/query/saved/${id}`);
  },

  async fetchSchema(): Promise<SchemaResponse> {
    return http.get('/query/schema');
  },

  async fetchTableSchema(table: string): Promise<{ table: string; filename: string; column_count: number; columns: { name: string; type: string; null: boolean; key: string }[] }> {
    return http.get(`/query/schema/${encodeURIComponent(table)}`);
  },

  async validateQuery(query: string, dataset?: string): Promise<ValidatorResponse> {
    return http.post('/query/validate', runForm(query, dataset), { timeoutMs: RUN_TIMEOUT_MS });
  },

  async aiSql(question: string, dataset?: string): Promise<AiSqlResponse> {
    return http.post('/ai/sql', runForm(question, dataset), { timeoutMs: 30_000 });
  },

  async exportServerCSV(query: string, dataset?: string, filename?: string) {
    const blob = await http.post<Blob>('/query/export', runForm(query, dataset, false, { format: 'csv' }), {
      responseType: 'blob',
      timeoutMs: RUN_TIMEOUT_MS,
    });
    saveBlob(blob, filename || `query_result_${Date.now()}.csv`);
  },

  async exportServerJSON(query: string, dataset?: string, filename?: string) {
    const blob = await http.post<Blob>('/query/export', runForm(query, dataset, false, { format: 'json' }), {
      responseType: 'blob',
      timeoutMs: RUN_TIMEOUT_MS,
    });
    saveBlob(blob, filename || `query_result_${Date.now()}.json`);
  },

  exportCSV(data: Record<string, any>[], filename: string) {
    downloadBlob(data, filename);
  },

  exportJSON(data: Record<string, any>[], filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.includes('.') ? filename : `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  },

  exportSQL(query: string, filename: string) {
    const blob = new Blob([`-- ${filename}\n-- Exported: ${new Date().toISOString()}\n\n${query}`], { type: 'text/sql' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.includes('.') ? filename : `${filename}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  },

  exportExcel(data: Record<string, any>[], filename: string) {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((row) => headers.map((h) => {
        const val = row[h];
        const str = val == null ? '' : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')),
    ];
    const csv = csvRows.join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  },

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  },

  async profileQuery(query: string, dataset?: string): Promise<QueryProfile> {
    return http.post('/query/profile', runForm(query, dataset));
  },

  async explainQuery(query: string, dataset?: string): Promise<QueryPlan> {
    return http.post('/query/explain', runForm(query, dataset));
  },

  async resultToDataset(query: string, dataset?: string, outputName?: string): Promise<ResultToDatasetResponse> {
    return http.post('/query/result-to-dataset', runForm(query, dataset, false, outputName ? { output_name: outputName } : {}));
  },

  async previewTable(name: string, limit = 20): Promise<TablePreviewResult> {
    return http.get('/query/preview', { name, limit });
  },
};