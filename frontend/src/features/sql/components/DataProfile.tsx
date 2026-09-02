import { useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Loader2, Database, AlertTriangle, CheckCircle, Eye,
  ChevronDown, ChevronRight, Hash, Type, Calendar, Binary,
} from 'lucide-react';
import styles from './DataProfile.module.css';
import { sqlService } from '../services/sqlEditor.service';
import { QueryProfile, ColumnProfile } from '../types';

interface DataProfileProps {
  query: string;
  dataset?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getIcon(dtype: string) {
  const t = dtype.toLowerCase();
  if (t.includes('int') || t.includes('float') || t.includes('double') || t.includes('decimal') || t.includes('numeric')) return Hash;
  if (t.includes('date') || t.includes('time') || t.includes('timestamp')) return Calendar;
  if (t.includes('bool')) return Binary;
  return Type;
}

function NullBar({ pct }: { pct: number }) {
  return (
    <div className={styles.nullBar}>
      <div className={styles.nullBarFill} style={{ width: `${Math.min(pct, 100)}%` }} />
      <span className={styles.nullBarLabel}>{pct}%</span>
    </div>
  );
}

const ColumnCard = memo(function ColumnCard({ col }: { col: ColumnProfile }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getIcon(col.dtype);
  const hasIssues = col.null_pct > 50 || col.unique_pct < 2;

  return (
    <div className={`${styles.columnCard} ${hasIssues ? styles.columnCardWarn : ''}`}>
      <button onClick={() => setExpanded(!expanded)} className={styles.columnHeader}>
        <div className={styles.columnHeaderLeft}>
          {expanded ? <ChevronDown className={styles.columnChevron} /> : <ChevronRight className={styles.columnChevron} />}
          <Icon className={styles.columnTypeIcon} />
          <span className={styles.columnName}>{col.name}</span>
          <span className={styles.columnType}>{col.dtype}</span>
        </div>
        <div className={styles.columnHeaderRight}>
          {hasIssues && <AlertTriangle className={styles.warnIcon} />}
          <NullBar pct={col.null_pct} />
        </div>
      </button>
      {expanded && (
        <div className={styles.columnDetails}>
          <div className={styles.statGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Unique</span>
              <span className={styles.statValue}>{col.unique_count.toLocaleString()}</span>
              <span className={styles.statSub}>{col.unique_pct}%</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Nulls</span>
              <span className={styles.statValue}>{col.null_count.toLocaleString()}</span>
              <span className={styles.statSub}>{col.null_pct}%</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Duplicates</span>
              <span className={styles.statValue}>{col.duplicate_count.toLocaleString()}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Memory</span>
              <span className={styles.statValue}>{formatBytes(col.memory_bytes)}</span>
            </div>
            {col.mean_value != null && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Mean</span>
                <span className={styles.statValue}>{col.mean_value}</span>
              </div>
            )}
            {col.median_value != null && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Median</span>
                <span className={styles.statValue}>{col.median_value}</span>
              </div>
            )}
            {col.std_value != null && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Std Dev</span>
                <span className={styles.statValue}>{col.std_value}</span>
              </div>
            )}
            {col.min_value != null && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Min</span>
                <span className={styles.statValue}>{col.min_value}</span>
              </div>
            )}
            {col.max_value != null && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Max</span>
                <span className={styles.statValue}>{col.max_value}</span>
              </div>
            )}
          </div>
          {col.sample_values.length > 0 && (
            <div className={styles.samples}>
              <span className={styles.statLabel}>Sample Values</span>
              <div className={styles.sampleTags}>
                {col.sample_values.map((v, i) => (
                  <span key={i} className={styles.sampleTag}>{v}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export const DataProfile = memo(function DataProfile({ query, dataset }: DataProfileProps) {
  const [profile, setProfile] = useState<QueryProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProfile = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await sqlService.profileQuery(query, dataset);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [query, dataset]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <BarChart3 className={styles.headerIcon} />
        <span className={styles.headerText}>Data Profiling</span>
        <button onClick={handleProfile} disabled={loading || !query.trim()} className={styles.profileBtn}>
          {loading ? <Loader2 className={styles.btnSpinner} /> : <Eye className={styles.btnIcon} />}
          {loading ? 'Analyzing...' : 'Profile Data'}
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          <AlertTriangle className={styles.errorIcon} />
          {error}
        </div>
      )}

      {profile && (
        <div className={styles.results}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <Database className={styles.summaryIcon} />
              <div>
                <div className={styles.summaryValue}>{profile.summary.total_rows.toLocaleString()}</div>
                <div className={styles.summaryLabel}>Rows</div>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <Hash className={styles.summaryIcon} />
              <div>
                <div className={styles.summaryValue}>{profile.summary.total_columns}</div>
                <div className={styles.summaryLabel}>Columns</div>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <AlertTriangle className={styles.summaryIcon} />
              <div>
                <div className={styles.summaryValue}>{profile.summary.missing_cells.toLocaleString()}</div>
                <div className={styles.summaryLabel}>Missing Cells</div>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <CheckCircle className={styles.summaryIcon} />
              <div>
                <div className={styles.summaryValue}>{formatBytes(profile.summary.total_memory_bytes)}</div>
                <div className={styles.summaryLabel}>Memory</div>
              </div>
            </div>
          </div>

          <div className={styles.columnList}>
            {profile.columns.map((col) => (
              <ColumnCard key={col.name} col={col} />
            ))}
          </div>
        </div>
      )}

      {!profile && !loading && !error && (
        <div className={styles.emptyState}>
          <BarChart3 className={styles.emptyIcon} />
          <p className={styles.emptyText}>Click "Profile Data" to analyze your query results</p>
          <p className={styles.emptySubtext}>Get statistics on columns, nulls, types, and memory usage</p>
        </div>
      )}
    </div>
  );
});
