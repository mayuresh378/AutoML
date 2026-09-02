import { useEffect, useState } from 'react';
import { Database, GitFork, Layers } from 'lucide-react';
import { EngineDataset } from '../../../../services/engine.service';
import { datasetsService } from '../../../../services/datasets.service';
import type { DatasetProfile, DatasetAnalysisResult } from '../../../../types/api';
import { SectionCard } from './SectionCard';
import styles from './DatasetStep.module.css';

interface Props {
  datasets: EngineDataset[];
  selectedDataset: string;
  targetColumn: string;
  profile: DatasetProfile | null;
  taskType: string;
  isCluster: boolean;
  nClusters: number;
  onDatasetChange: (v: string) => void;
  onTargetChange: (v: string) => void;
  onNClustersChange: (v: number) => void;
}

export function DatasetStep({
  datasets, selectedDataset, targetColumn, profile, taskType, isCluster, nClusters,
  onDatasetChange, onTargetChange, onNClustersChange,
}: Props) {
  const dataset = datasets.find(d => d.name === selectedDataset);
  const targetColumns = dataset?.columns || [];
  const [analysis, setAnalysis] = useState<DatasetAnalysisResult | null>(null);

  useEffect(() => {
    if (!selectedDataset || !targetColumn || taskType === 'clustering') {
      setAnalysis(null);
      return;
    }
    let cancelled = false;
    datasetsService.analyze(selectedDataset, targetColumn)
      .then(a => { if (!cancelled) setAnalysis(a); })
      .catch(() => { if (!cancelled) setAnalysis(null); });
    return () => { cancelled = true; };
  }, [selectedDataset, targetColumn, taskType]);

  const rows = profile?.rows ?? dataset?.rows ?? 0;
  const cols = profile?.columns ?? dataset?.columns.length ?? 0;
  const missingPct = profile?.missing_pct;
  const dist = analysis?.class_imbalance?.distribution;
  const classes = dist ? Object.keys(dist).length : null;

  const featureCount = isCluster ? cols : Math.max(0, cols - 1);
  const estMemMB = rows > 0 && cols > 0 ? ((rows * cols * 8) / (1024 * 1024)).toFixed(1) : '—';

  const stats = [
    { label: 'Rows', value: rows > 0 ? rows.toLocaleString() : '—' },
    { label: 'Columns', value: cols > 0 ? String(cols) : '—' },
    { label: 'Features', value: cols > 0 ? String(featureCount) : '—' },
    { label: 'Missing', value: missingPct != null ? `${missingPct.toFixed(1)}%` : '—' },
    { label: 'Classes', value: classes != null ? String(classes) : '—' },
    { label: 'Est. Memory', value: estMemMB !== '—' ? `${estMemMB} MB` : '—' },
  ];

  const handleLoadSample = async (key: string) => {
    try {
      const sample = await datasetsService.loadSample(key);
      onDatasetChange(sample.name);
      if (sample.default_target && !isCluster) {
        onTargetChange(sample.default_target);
      }
    } catch (e) {
      console.error('Failed to load sample dataset', e);
    }
  };

  return (
    <SectionCard number={1} title="Dataset" subtitle="Select a dataset, try a built-in benchmark dataset, or upload your own CSV">
      <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>Try Demo Sample Dataset:</span>
        <button
          type="button"
          onClick={() => handleLoadSample('iris')}
          style={{
            padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', cursor: 'pointer',
            border: '1px solid rgba(99, 102, 241, 0.4)', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', fontWeight: 500
          }}
        >
          🌸 Iris (Classification)
        </button>
        <button
          type="button"
          onClick={() => handleLoadSample('titanic')}
          style={{
            padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', cursor: 'pointer',
            border: '1px solid rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontWeight: 500
          }}
        >
          🚢 Titanic (Survival Classification)
        </button>
        <button
          type="button"
          onClick={() => handleLoadSample('housing')}
          style={{
            padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', cursor: 'pointer',
            border: '1px solid rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', fontWeight: 500
          }}
        >
          🏡 Housing (Price Regression)
        </button>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <span className={styles.label}><Database size={13} /> Dataset</span>
          <select
            className={styles.select}
            value={selectedDataset}
            onChange={(e) => onDatasetChange(e.target.value)}
          >
            <option value="">Select dataset...</option>
            {datasets.map(d => (
              <option key={d.name} value={d.name}>{d.name} ({d.rows.toLocaleString()} rows)</option>
            ))}
          </select>
        </div>

        {!isCluster && (
          <div className={styles.field}>
            <span className={styles.label}><GitFork size={13} /> Target Column</span>
            <select
              className={styles.select}
              value={targetColumn}
              onChange={(e) => onTargetChange(e.target.value)}
            >
              <option value="">Select target...</option>
              {targetColumns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {isCluster && (
          <div className={styles.field}>
            <span className={styles.label}><Layers size={13} /> Clusters (k)</span>
            <input
              className={styles.input}
              type="number"
              value={nClusters}
              min={2}
              max={20}
              onChange={(e) => onNClustersChange(Number(e.target.value))}
            />
          </div>
        )}
      </div>

      {selectedDataset && (
        <>
          <div className={styles.statsGrid}>
            {stats.map(s => (
              <div key={s.label} className={styles.statBox}>
                <span className={styles.statVal}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>

          {dist && Object.keys(dist).length > 0 && (
            <div className={styles.distCard}>
              <span className={styles.distTitle}>Class Distribution</span>
              <div className={styles.distList}>
                {Object.entries(dist).sort((a, b) => b[1].count - a[1].count).map(([k, v]) => (
                  <div key={k} className={styles.distRow}>
                    <span className={styles.distName}>{k}</span>
                    <div className={styles.distBarWrap}>
                      <div className={styles.distBar} style={{ width: `${v.pct}%` }} />
                    </div>
                    <span className={styles.distCount}>{v.count.toLocaleString()} ({v.pct.toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
