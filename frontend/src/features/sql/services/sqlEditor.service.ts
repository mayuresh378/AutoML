import { http, downloadBlob } from '../../../services/http';
import { QueryResult, QueryHistoryItem, SavedQuery, QueryProfile, QueryPlan, ResultToDatasetResponse, TablePreviewResult } from '../types';

const STORAGE_KEYS = {
  history: 'sql-query-history',
  saved: 'sql-saved-queries',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key: string, data: any) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

export const sqlService = {
  async executeQuery(query: string, dataset?: string, signal?: AbortSignal): Promise<QueryResult> {
    const form = new FormData();
    form.append('query', query);
    if (dataset) form.append('dataset', dataset);
    const start = performance.now();
    const data = await http.post('/query', form, { signal });
    const executionTime = performance.now() - start;
    return { ...data, executionTime: Math.round(executionTime) };
  },

  getHistory(): QueryHistoryItem[] {
    return loadFromStorage<QueryHistoryItem[]>(STORAGE_KEYS.history, []);
  },

  addToHistory(item: Omit<QueryHistoryItem, 'id' | 'executedAt'>) {
    const history = this.getHistory();
    const entry: QueryHistoryItem = { ...item, id: crypto.randomUUID(), executedAt: Date.now(), favorite: false, pinned: false };
    history.unshift(entry);
    saveToStorage(STORAGE_KEYS.history, history.slice(0, 200));
    return entry;
  },

  updateHistory(id: string, updates: Partial<QueryHistoryItem>) {
    const history = this.getHistory().map((h) => h.id === id ? { ...h, ...updates } : h);
    saveToStorage(STORAGE_KEYS.history, history);
  },

  deleteHistory(id: string) {
    const history = this.getHistory().filter((h) => h.id !== id);
    saveToStorage(STORAGE_KEYS.history, history);
  },

  clearHistory() {
    saveToStorage(STORAGE_KEYS.history, []);
  },

  getSavedQueries(): SavedQuery[] {
    return loadFromStorage<SavedQuery[]>(STORAGE_KEYS.saved, []);
  },

  saveQuery(query: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>) {
    const saved = this.getSavedQueries();
    const entry: SavedQuery = { ...query, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() };
    saved.push(entry);
    saveToStorage(STORAGE_KEYS.saved, saved);
    return entry;
  },

  updateSavedQuery(id: string, updates: Partial<SavedQuery>) {
    const saved = this.getSavedQueries().map((q) => q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q);
    saveToStorage(STORAGE_KEYS.saved, saved);
  },

  deleteSavedQuery(id: string) {
    const saved = this.getSavedQueries().filter((q) => q.id !== id);
    saveToStorage(STORAGE_KEYS.saved, saved);
  },

  exportCSV(data: Record<string, any>[], filename: string) {
    downloadBlob(data, filename);
  },

  exportJSON(data: Record<string, any>[], filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  },

  exportSQL(query: string, filename: string) {
    const blob = new Blob([`-- ${filename}\n-- Exported: ${new Date().toISOString()}\n\n${query}`], { type: 'text/sql' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.sql`;
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
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  },

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  },

  async profileQuery(query: string, dataset?: string): Promise<QueryProfile> {
    const form = new FormData();
    form.append('query', query);
    if (dataset) form.append('dataset', dataset);
    return http.post('/query/profile', form);
  },

  async explainQuery(query: string, dataset?: string): Promise<QueryPlan> {
    const form = new FormData();
    form.append('query', query);
    if (dataset) form.append('dataset', dataset);
    return http.post('/query/explain', form);
  },

  async resultToDataset(query: string, dataset?: string, outputName?: string): Promise<ResultToDatasetResponse> {
    const form = new FormData();
    form.append('query', query);
    if (dataset) form.append('dataset', dataset);
    if (outputName) form.append('output_name', outputName);
    return http.post('/query/result-to-dataset', form);
  },

  async previewTable(name: string, limit = 20): Promise<TablePreviewResult> {
    return http.get('/query/preview', { name, limit });
  },
};
