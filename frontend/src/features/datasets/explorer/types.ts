import type {
  DatasetAnalysisResult,
  DatasetProfile,
  DatasetPreview,
} from '../../../types/api';

export type { DatasetAnalysisResult, DatasetProfile, DatasetPreview };

export interface DatasetMeta {
  id: string | null;
  name: string;
  filename?: string;
  rows: number;
  columns: string[];
  size_kb: number;
  dtypes: Record<string, string>;
  status: string;
  uploaded_at: string;
  project_id: string | null;
  description?: string | null;
  tags: string[];
  version: number;
  source: string;
  source_url?: string | null;
}

export type ExplorerTabId =
  | 'overview'
  | 'preview'
  | 'schema'
  | 'statistics'
  | 'distribution'
  | 'correlation'
  | 'quality'
  | 'insights'
  | 'lineage'
  | 'versions';

export interface ExplorerQuickAction {
  id: string;
  label: string;
  description: string;
  to: string;
}
