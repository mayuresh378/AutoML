import { useMemo } from 'react';
import {
  Rows3, Columns3, Database, AlertTriangle, CopyX, TrendingUp, Target,
  Sparkles, ArrowRight, GitBranch, Wand2, Braces, Rocket, LayoutGrid,
} from 'lucide-react';
import type { DatasetAnalysisResult, DatasetMeta, DatasetPreview, DatasetProfile } from '../types';
import { StatCard } from '../components/StatCard';
import { QualityGauge } from '../components/QualityGauge';
import { featureTypeMeta, fmt, gradeColor, severityHex, severityLabel } from '../utils';
import { cn } from '../../../../lib/cn';

interface OverviewTabProps {
  dataset: DatasetMeta;
  analysis?: DatasetAnalysisResult;
  profile?: DatasetProfile;
  preview?: DatasetPreview;
  onQuickAction: (to: string) => void;
}

const actions = [
  { id: 'profiling', label: 'Data Profiling', description: 'Deep column profiles', icon: Sparkles, to: '/app/profiling' },
  { id: 'cleaning', label: 'Data Cleaning', description: 'Fix missing & duplicates', icon: Wand2, to: '/app/cleaning' },
  { id: 'features', label: 'Feature Engineering', description: 'Create new features', icon: GitBranch, to: '/app/feature-engineering' },
  { id: 'sql', label: 'SQL Studio', description: 'Query with DuckDB', icon: Braces, to: '/app/sql' },
  { id: 'automl', label: 'AutoML', description: 'Train & compare models', icon: Rocket, to: '/app/engine' },
  { id: 'models', label: 'Model Registry', description: 'Browse trained models', icon: LayoutGrid, to: '/app/models' },
];

export function OverviewTab({ dataset, analysis, profile, preview, onQuickAction }: OverviewTabProps) {
  const qs = analysis?.quality_score;
  const featureTypes = analysis?.feature_types || {};
  const featureCount = useMemo(() => {
    const total = Object.values(featureTypes).reduce((a, arr) => a + (arr?.length || 0), 0);
    return { total, types: Object.entries(featureTypes) as [string, string[]][] };
  }, [featureTypes]);

  const missing = analysis?.missing;
  const duplicates = analysis?.duplicates;
  const outliers = analysis?.outliers;
  const imbalance = analysis?.class_imbalance;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={<Rows3 className="w-4 h-4" />} label="Rows" value={fmt.num(analysis?.rows ?? dataset.rows)} sub="records" tone="sky" />
        <StatCard icon={<Columns3 className="w-4 h-4" />} label="Columns" value={fmt.num(analysis?.columns ?? dataset.columns?.length)} sub="features" tone="violet" />
        <StatCard icon={<Database className="w-4 h-4" />} label="Size" value={fmt.bytes(dataset.size_kb)} sub="on disk" tone="default" />
        <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Missing" value={fmt.pct(missing?.missing_pct)} sub={missing ? `${fmt.int(missing.total_missing)} cells` : '…'} tone={missing?.severity === 'high' ? 'danger' : missing?.severity === 'medium' ? 'warning' : 'success'} />
        <StatCard icon={<CopyX className="w-4 h-4" />} label="Duplicates" value={fmt.dec(duplicates?.count)} sub={duplicates ? fmt.pct(duplicates.pct) : '…'} tone={duplicates?.severity === 'high' ? 'danger' : duplicates?.severity === 'medium' ? 'warning' : 'success'} />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Outliers" value={fmt.int(outliers?.total_outliers)} sub={outliers ? `${fmt.pct(outliers.mean_pct)} avg / col` : '…'} tone={outliers?.mean_pct && outliers.mean_pct > 5 ? 'warning' : 'success'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-5">
          <QualityGauge score={qs?.total ?? 0} grade={qs?.grade} label="Quality Score" />
          <div className="space-y-2.5 flex-1 min-w-0">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Overall Data Quality</div>
              <div className="text-xs text-zinc-500 mt-0.5">Weighted across completeness, consistency, validity and uniqueness</div>
            </div>
            {qs?.components && (
              <div className="space-y-1.5">
                {Object.entries(qs.components).map(([key, v]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-24 text-[10px] text-zinc-500 uppercase tracking-wide truncate">{key.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: gradeColor(qs.grade) }} />
                    </div>
                    <span className="w-9 text-right text-[10px] font-mono text-zinc-400">{Math.round(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-fuchsia-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Target Column</h3>
          </div>
          {analysis?.target ? (
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 px-3 py-1.5">
                <span className="font-mono text-sm font-semibold text-fuchsia-300">{analysis.target}</span>
                <span className="text-[10px] text-fuchsia-400/70">suggested</span>
              </div>
              {analysis.target_detection?.candidates && (
                <div className="space-y-1.5">
                  {analysis.target_detection.candidates.slice(0, 4).map((c) => (
                    <div key={c.column} className="flex items-center gap-2">
                      <span className="w-32 truncate font-mono text-[11px] text-zinc-400">{c.column}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full bg-fuchsia-500/70" style={{ width: `${(c.score / 10) * 100}%` }} />
                      </div>
                      <span className="w-6 text-right text-[10px] font-mono text-zinc-500">{c.score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No obvious target column detected. Column cardinality and naming hints are used.</p>
          )}
          <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between text-xs">
            <span className="text-zinc-500">Feature mix</span>
            <span className="text-zinc-300 font-medium">{featureCount.total} total</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {featureCount.types.map(([kind, cols]) => {
              const meta = featureTypeMeta(kind);
              return (
                <span key={kind} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', meta.cls)}>
                  <meta.Icon className="w-2.5 h-2.5" />
                  {meta.label} · {cols.length}
                </span>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">Dataset Notes</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {dataset.description || `Dataset ${dataset.name} contains ${fmt.int(analysis?.rows ?? dataset.rows)} rows and ${fmt.int(analysis?.columns ?? dataset.columns?.length)} columns.`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div className="text-zinc-500">Source <span className="block text-zinc-300 capitalize">{dataset.source || 'upload'}</span></div>
            <div className="text-zinc-500">Uploaded <span className="block text-zinc-300">{fmt.dateTime(dataset.uploaded_at)}</span></div>
            <div className="text-zinc-500">Status <span className="block text-zinc-300 capitalize">{dataset.status}</span></div>
            <div className="text-zinc-500">Version <span className="block text-zinc-300">v{dataset.version ?? 1}</span></div>
          </div>
          {dataset.tags && dataset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {dataset.tags.map((t) => (
                <span key={t} className="rounded-full bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">#{t}</span>
              ))}
            </div>
          )}
          {imbalance?.detected && (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Target imbalance {imbalance.imbalance_ratio}x ({severityLabel(imbalance.severity || '')}) across {imbalance.classes} classes
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { label: 'Missing Values', severity: missing?.severity, value: missing ? `${fmt.pct(missing.missing_pct)} of cells · ${fmt.int(missing.total_missing)} values` : '…', detail: `${missing?.columns?.length || 0} columns affected` },
          { label: 'Duplicate Rows', severity: duplicates?.severity, value: duplicates ? `${fmt.int(duplicates.count)} rows · ${fmt.pct(duplicates.pct)}` : '…', detail: 'Exact row duplicates' },
          { label: 'Outliers', severity: outliers?.mean_pct && outliers.mean_pct > 5 ? 'medium' : 'low', value: outliers ? `${fmt.int(outliers.total_outliers)} values · ${fmt.pct(outliers.mean_pct)} avg/col` : '…', detail: `${outliers?.columns?.length || 0} numeric columns flagged` },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{card.label}</h4>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium" style={{ color: severityHex(card.severity || 'low') }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: severityHex(card.severity || 'low') }} />
                {severityLabel(card.severity || 'low')}
              </span>
            </div>
            <div className="text-lg font-semibold text-zinc-100 font-mono">{card.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{card.detail}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Recommended Next Steps</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Move the dataset through the ML lifecycle</p>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {actions.map((a) => (
            <button
              key={a.id}
              onClick={() => onQuickAction(`${a.to}?dataset=${encodeURIComponent(dataset.name)}`)}
              className="group rounded-xl border border-border bg-white/[0.02] p-3.5 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.04]"
            >
              <a.icon className="w-4 h-4 text-primary mb-2 transition-transform group-hover:scale-110" />
              <div className="text-xs font-semibold text-zinc-200">{a.label}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{a.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
