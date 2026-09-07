export interface QueryResult {
  columns: string[];
  rows: number;
  data: Record<string, any>[];
  query: string;
  executionTime?: number;
  memoryUsed?: number;
  rowsScanned?: number;
  query_id?: string;
  total_rows?: number;
  truncated?: boolean;
  page?: number;
  page_size?: number;
  execution_time_ms?: number;
  status?: 'success' | 'requires_confirmation' | 'timeout' | 'cancelled' | 'error';
  message?: string;
  operations?: string[];
  dataset_name?: string;
}

export interface QueryTab {
  id: string;
  name: string;
  query: string;
  isDirty: boolean;
  result: QueryResult | null;
  error: string | null;
  isRunning: boolean;
  createdAt: number;
  updatedAt: number;
  runningInfo?: { clientId?: string; queryId?: string; startedAt: number; operation?: string } | null;
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  dataset: string | null;
  executedAt: number;
  executionTime?: number;
  rowsReturned?: number;
  favorite: boolean;
  pinned: boolean;
  status?: string;
  error?: string | null;
  created_at?: string;
  execution_time_ms?: number | null;
  rows_returned?: number | null;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  dataset: string | null;
  folder: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  created_at?: string;
  updated_at?: string;
}

export interface SaveQueryPayload {
  name: string;
  query: string;
  dataset?: string | null;
  folder?: string;
  tags?: string[];
  pinned?: boolean;
}

export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  query: string;
  category: string;
}

export interface DatasetSchema {
  name: string;
  tables: TableSchema[];
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  foreignKey?: boolean;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  null_count: number;
  null_pct: number;
  unique_count: number;
  unique_pct: number;
  duplicate_count: number;
  min_value: string | null;
  max_value: string | null;
  mean_value: number | null;
  median_value: number | null;
  std_value: number | null;
  memory_bytes: number;
  sample_values: string[];
}

export interface ExecutionPlanNode {
  id: string;
  type: string;
  description: string;
  cost: number;
  rows: number;
  children: ExecutionPlanNode[];
}

export const QUERY_TEMPLATES: QueryTemplate[] = [
  { id: 'select-all', name: 'Select All', description: 'SELECT * FROM table', query: 'SELECT *\nFROM data\nLIMIT 100;', category: 'Basic' },
  { id: 'count', name: 'Count', description: 'COUNT all rows', query: 'SELECT COUNT(*) as total\nFROM data;', category: 'Basic' },
  { id: 'avg', name: 'Average', description: 'AVG of a column', query: 'SELECT AVG(column_name) as average\nFROM data;', category: 'Basic' },
  { id: 'group-by', name: 'Group By', description: 'GROUP BY aggregation', query: 'SELECT column_name, COUNT(*) as count\nFROM data\nGROUP BY column_name\nORDER BY count DESC;', category: 'Aggregation' },
  { id: 'having', name: 'Having', description: 'GROUP BY with HAVING', query: 'SELECT column_name, COUNT(*) as count\nFROM data\nGROUP BY column_name\nHAVING COUNT(*) > 1;', category: 'Aggregation' },
  { id: 'inner-join', name: 'Inner Join', description: 'INNER JOIN two tables', query: 'SELECT a.*, b.*\nFROM table_a a\nINNER JOIN table_b b ON a.id = b.id\nLIMIT 100;', category: 'Joins' },
  { id: 'left-join', name: 'Left Join', description: 'LEFT JOIN two tables', query: 'SELECT a.*, b.*\nFROM table_a a\nLEFT JOIN table_b b ON a.id = b.id\nLIMIT 100;', category: 'Joins' },
  { id: 'window-rank', name: 'Window - Rank', description: 'RANK() window function', query: 'SELECT column_name,\n  RANK() OVER (ORDER BY column_name DESC) as rank\nFROM data\nLIMIT 100;', category: 'Window' },
  { id: 'window-row-number', name: 'Window - Row Number', description: 'ROW_NUMBER() window function', query: 'SELECT column_name,\n  ROW_NUMBER() OVER (PARTITION BY column_name ORDER BY column_name) as row_num\nFROM data\nLIMIT 100;', category: 'Window' },
  { id: 'cte', name: 'CTE', description: 'Common Table Expression', query: 'WITH cte AS (\n  SELECT column_name, COUNT(*) as count\n  FROM data\n  GROUP BY column_name\n)\nSELECT *\nFROM cte\nORDER BY count DESC\nLIMIT 100;', category: 'Advanced' },
  { id: 'top-n', name: 'Top N Records', description: 'LIMIT with ORDER BY', query: 'SELECT *\nFROM data\nORDER BY column_name DESC\nLIMIT 10;', category: 'Basic' },
  { id: 'distinct', name: 'Distinct Values', description: 'SELECT DISTINCT', query: 'SELECT DISTINCT column_name\nFROM data\nORDER BY column_name;', category: 'Basic' },
];

export interface QueryProfile {
  columns: ColumnProfile[];
  summary: {
    total_rows: number;
    total_columns: number;
    total_memory_bytes: number;
    duplicate_rows: number;
    missing_cells: number;
    total_cells: number;
  };
  query: string;
}

export interface QueryPlan {
  plan: string[];
  query: string;
}

export interface ResultToDatasetResponse {
  dataset: string;
  rows: number;
  columns: string[];
  file_size: number;
}

export interface TablePreviewResult {
  columns: string[];
  rows: number;
  data: Record<string, any>[];
  dataset: string;
}

export interface RunQueryOptions {
  dataset?: string;
  confirmDestructive?: boolean;
  page?: number;
  pageSize?: number;
  clientId?: string;
  signal?: AbortSignal;
}

export interface SchemaColumn {
  name: string;
  dtype: string;
  nullable: boolean;
  primary_key?: boolean;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
  rows: number;
  size_kb: number;
  source: string;
  shared: boolean;
  owned_by_me: boolean;
}

export interface SchemaResponse {
  datasets: SchemaTable[];
}

export interface ValidatorResponse {
  valid: boolean;
  message: string;
  operations?: string[];
}

export interface AiSqlResponse {
  sql: string;
  explanation?: string;
  error?: string;
}

export function toLocalHistory(item: Partial<QueryHistoryItem> & { id: string }): QueryHistoryItem {
  return {
    id: item.id,
    query: item.query ?? '',
    dataset: item.dataset ?? null,
    executedAt: item.executedAt ?? (item.created_at ? new Date(item.created_at).getTime() : Date.now()),
    executionTime: item.executionTime ?? item.execution_time_ms ?? undefined,
    rowsReturned: item.rowsReturned ?? item.rows_returned ?? undefined,
    favorite: Boolean(item.favorite),
    pinned: Boolean(item.pinned),
    status: item.status,
    error: item.error ?? null,
  };
}

export function toLocalSaved(item: Partial<SavedQuery> & { id: string }): SavedQuery {
  return {
    id: item.id,
    name: item.name ?? 'Untitled',
    query: item.query ?? '',
    dataset: item.dataset ?? null,
    folder: item.folder ?? '',
    tags: item.tags ?? [],
    pinned: Boolean(item.pinned),
    createdAt: item.createdAt ?? (item.created_at ? new Date(item.created_at).getTime() : Date.now()),
    updatedAt: item.updatedAt ?? (item.updated_at ? new Date(item.updated_at).getTime() : Date.now()),
  };
}

export const KEYBOARD_SHORTCUTS = [
  { key: 'Ctrl + Enter', action: 'Run Query' },
  { key: 'Ctrl + S', action: 'Save Query' },
  { key: 'Ctrl + Space', action: 'Autocomplete' },
  { key: 'Ctrl + /', action: 'Toggle Comment' },
  { key: 'Alt + Shift + F', action: 'Format SQL' },
  { key: 'Ctrl + F', action: 'Search' },
  { key: 'Ctrl + H', action: 'Replace' },
];
