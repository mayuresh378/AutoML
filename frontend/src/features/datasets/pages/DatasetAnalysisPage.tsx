import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { datasetsService } from '../../../services/datasets.service';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { DatasetSelect } from '../../../components/ui/DatasetSelect';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import type { ColumnProfile } from '../../../types/api';
import styles from './DatasetAnalysisPage.module.css';

const fmtInt = (n?: number | null) => (n == null || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString());

const fmtNum = (n?: number | null) => {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  if (a >= 1) return Number(n.toFixed(2)).toString();
  return Number(n.toFixed(4)).toString();
};

const priorityColor = (p: string | undefined) => {
  if (p === 'high') return 'error';
  if (p === 'medium') return 'warning';
  if (p === 'low') return 'info';
  return 'default';
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factValue}>{value}</span>
      <span className={styles.factLabel}>{label}</span>
    </div>
  );
}

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const hue = score >= 90 ? 142 : score >= 80 ? 48 : score >= 65 ? 38 : score >= 50 ? 15 : 0;
  return (
    <div className={styles.gauge}>
      <div className="relative w-14 h-14 shrink-0">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.5" fill="none"
            stroke={`hsl(${hue}, 70%, 50%)`} strokeWidth="3"
            strokeDasharray={`${score * 0.31} 31`} strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className={styles.gaugeGrade}>{grade}</span>
        </span>
      </div>
      <div className="min-w-0">
        <p className={styles.statLabel}>Quality Score</p>
        <p className={styles.gaugeScore}>{score}/100</p>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue} title={value}>{value}</span>
    </div>
  );
}

function ColumnCard({ col, rows, onClick }: { col: ColumnProfile; rows: number; onClick: () => void }) {
  const missingPct = rows > 0 && col.missing != null ? (col.missing / rows) * 100 : 0;
  const numeric = typeof col.mean === 'number';
  const hasTop = col.top_values && Object.keys(col.top_values).length > 0;

  return (
    <button className={styles.colCard} onClick={onClick}>
      <div className={styles.colHead}>
        <span className={styles.colName} title={col.name}>{col.name}</span>
        <span className={styles.dtypeChip}>{col.dtype}</span>
      </div>

      <div className={styles.missingRow}>
        <span className={styles.missingLabel}>missing</span>
        <div className={styles.missingTrack}>
          <div className={styles.missingFill} style={{ width: `${Math.min(missingPct, 100)}%` }} />
        </div>
        <span className={styles.statLineValue}>{missingPct.toFixed(1)}%</span>
      </div>

      <div className={styles.colStats}>
        {numeric ? (
          <>
            <div className={styles.statLine}>
              <span className={styles.statLineLabel}>mean</span>
              <span className={styles.statLineValue}>
                <strong>{fmtNum(col.mean)}</strong> · med {fmtNum(col.median)}
              </span>
            </div>
            <div className={styles.statLine}>
              <span className={styles.statLineLabel}>range</span>
              <span className={styles.statLineValue}>{fmtNum(col.min)} – {fmtNum(col.max)}</span>
            </div>
            <div className={styles.statLine}>
              <span className={styles.statLineLabel}>std</span>
              <span className={styles.statLineValue}>{fmtNum(col.std)}</span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.statLine}>
              <span className={styles.statLineLabel}>unique</span>
              <span className={styles.statLineValue}>
                <strong>{fmtInt(col.unique_values)}</strong>
                {hasTop ? ' · top values' : ''}
              </span>
            </div>
            <div className={styles.statLine}>
              <span className={styles.statLineLabel}>outliers</span>
              <span className={styles.statLineValue}>{fmtInt(col.outliers)}</span>
            </div>
          </>
        )}
      </div>
    </button>
  );
}

function ColumnDetail({ col, rows }: { col: ColumnProfile; rows: number }) {
  const numeric = typeof col.mean === 'number';
  const missingPct = rows > 0 && col.missing != null ? (col.missing / rows) * 100 : 0;
  const top = col.top_values
    ? Object.entries(col.top_values).sort((a, b) => b[1] - a[1]).slice(0, 8)
    : [];
  const maxCount = top.length ? top[0][1] : 1;
  const denom = Math.max(rows - (col.missing ?? 0), 1);

  return (
    <div>
      <div className={styles.missingRow}>
        <span className={styles.missingLabel}>missing</span>
        <div className={styles.missingTrack}>
          <div className={styles.missingFill} style={{ width: `${Math.min(missingPct, 100)}%` }} />
        </div>
        <span className={styles.statLineValue}>{fmtInt(col.missing)} · {missingPct.toFixed(1)}%</span>
      </div>

      <p className={styles.sectionTitle}>Statistics</p>
      <div className={styles.tileGrid}>
        <Tile label="Rows" value={fmtInt(rows)} />
        <Tile label="Missing" value={fmtInt(col.missing)} />
        <Tile label="Unique" value={fmtInt(col.unique_values)} />
        <Tile label="Outliers" value={fmtInt(col.outliers)} />
        {numeric && (
          <>
            <Tile label="Mean" value={fmtNum(col.mean)} />
            <Tile label="Median" value={fmtNum(col.median)} />
            <Tile label="Min" value={fmtNum(col.min)} />
            <Tile label="Max" value={fmtNum(col.max)} />
            <Tile label="Std" value={fmtNum(col.std)} />
          </>
        )}
      </div>

      {top.length > 0 && (
        <>
          <p className={styles.sectionTitle}>Top Values</p>
          <div className="space-y-2">
            {top.map(([value, count]) => (
              <div key={value} className={styles.barRow}>
                <span className={styles.barValue} title={value}>{value || '(empty)'}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className={styles.barCount}>{fmtInt(count)} · {((count / denom) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function DatasetAnalysisPage() {
  const [selectedDataset, setSelectedDataset] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCol, setSelectedCol] = useState<ColumnProfile | null>(null);

  const { data: datasets, isLoading: datasetsLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
    select: (d: any) => d.datasets,
  });

  const { data: profile, isLoading: profileLoading, isError: profileError } = useQuery({
    queryKey: ['dataset', selectedDataset, 'profile'],
    queryFn: () => datasetsService.profile(selectedDataset),
    enabled: !!selectedDataset,
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['dataset', selectedDataset, 'analysis'],
    queryFn: () => datasetsService.analyze(selectedDataset),
    enabled: !!selectedDataset,
  });

  const columns = profile?.column_details ?? [];
  const filtered = useMemo(
    () => columns.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [columns, query],
  );

  const numericCols = columns.filter((c) => typeof c.mean === 'number').length;
  const missingPct = profile && profile.rows > 0 ? (profile.missing_values / profile.rows) * 100 : 0;
  const dtypeCount = profile?.dtypes ? Object.keys(profile.dtypes).length : 0;

  return (
    <PageContainer>
      <PageHeader title="Data Profiling" description="Explore column-level statistics, distributions and data quality" />

      <div className={styles.toolbar}>
        <div className={styles.toolbarField}>
          <label className={styles.toolbarLabel}>Dataset</label>
          <DatasetSelect
            datasets={datasets || []}
            value={selectedDataset}
            onChange={(name) => {
              setSelectedDataset(name);
              setSelectedCol(null);
              setQuery('');
            }}
            placeholder="Select a dataset"
            loading={datasetsLoading}
          />
        </div>
        {profile && (
          <div className={styles.facts}>
            <Fact label="Rows" value={fmtInt(profile.rows)} />
            <Fact label="Columns" value={fmtInt(profile.columns)} />
            <Fact label="Missing" value={`${missingPct.toFixed(1)}%`} />
            <Fact label="Duplicates" value={fmtInt(profile.duplicates)} />
          </div>
        )}
      </div>

      {!selectedDataset ? (
        <div className={styles.emptyState}>Select a dataset to begin profiling</div>
      ) : profileLoading ? (
        <div className="py-16 flex justify-center"><LoadingSpinner size="lg" /></div>
      ) : profileError ? (
        <div className={styles.emptyState}>Failed to load dataset profile</div>
      ) : profile ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mt-6">
            <StatCard label="Rows" value={fmtInt(profile.rows)} />
            <StatCard label="Columns" value={fmtInt(profile.columns)} />
            <StatCard label="Missing" value={`${missingPct.toFixed(1)}%`} />
            <StatCard label="Duplicates" value={fmtInt(profile.duplicates)} />
            <StatCard label="Numeric" value={fmtInt(numericCols)} />
            <StatCard label="Dtypes" value={fmtInt(dtypeCount)} />
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Column Profiles</CardTitle>
              <div className="flex items-center gap-4">
                <span className={styles.colCount}>{filtered.length} / {columns.length}</span>
                <div className={styles.searchWrap}>
                  <Search className={styles.searchIcon} />
                  <input
                    className={styles.searchInput}
                    placeholder="Filter columns…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <p className={styles.emptyState}>No columns match “{query}”</p>
              ) : (
                <div className={styles.colGrid}>
                  {filtered.map((col) => (
                    <ColumnCard key={col.name} col={col} rows={profile.rows} onClick={() => setSelectedCol(col)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6 mt-8">
            <Card>
              <CardHeader><CardTitle>Recommendations</CardTitle></CardHeader>
              <CardContent>
                {!analysis ? (
                  analysisLoading ? <LoadingSpinner size="sm" /> : <p className={styles.emptyState}>No analysis available</p>
                ) : analysis.recommendations?.length ? (
                  <div className="space-y-3">
                    {analysis.recommendations.map((rec, i) => (
                      <div key={i} className={styles.recItem}>
                        <Badge variant={priorityColor(rec.priority)} size="sm">{rec.priority}</Badge>
                        <div className="min-w-0">
                          <p className={styles.recText}>{rec.message}</p>
                          {!!rec.columns?.length && (
                            <p className={styles.recCols}>Columns: {rec.columns.join(', ')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyState}>No recommendations</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Top Correlations</CardTitle></CardHeader>
              <CardContent>
                {!analysis ? (
                  analysisLoading ? <LoadingSpinner size="sm" /> : <p className={styles.emptyState}>No correlation data</p>
                ) : analysis.correlation?.top_correlations?.length ? (
                  <div className="space-y-3">
                    {analysis.correlation.top_correlations.slice(0, 10).map((pair, i) => (
                      <div key={i} className={styles.corrRow}>
                        <span className={styles.corrName}>{pair.x}</span>
                        <span className={styles.corrName}>{pair.y}</span>
                        <div className={styles.corrTrack}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.abs(pair.value) * 100}%`,
                              backgroundColor: pair.value >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                            }}
                          />
                        </div>
                        <span className={styles.corrValue}>{pair.value.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyState}>
                    {analysis?.correlation?.message ?? 'Need at least 2 numeric columns'}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <Modal
        open={!!selectedCol}
        onClose={() => setSelectedCol(null)}
        size="lg"
        title={selectedCol?.name}
        description={selectedCol ? `${selectedCol.dtype} column profile` : undefined}
      >
        {selectedCol && profile && <ColumnDetail col={selectedCol} rows={profile.rows} />}
      </Modal>
    </PageContainer>
  );
}
