import { useMemo } from 'react';
import { AlertTriangle, ShieldAlert, ShieldCheck, Wand2, BarChart3, CheckCircle2, CircleAlert, Layers } from 'lucide-react';
import type { DatasetAnalysisResult, DatasetMeta, DatasetPreview, DatasetProfile } from '../types';
import { QualityGauge } from '../components/QualityGauge';
import { MissingMatrix } from '../components/MissingMatrix';
import { gradeColor, severityHex, severityLabel } from '../utils';
import { cn } from '../../../../lib/cn';

interface QualityTabProps {
  dataset: DatasetMeta;
  analysis?: DatasetAnalysisResult;
  profile?: DatasetProfile;
  preview?: DatasetPreview;
  onQuickAction: (to: string) => void;
}

export function QualityTab({ dataset, analysis, profile, preview, onQuickAction }: QualityTabProps) {
  const qs = analysis?.quality_score;
  const missing = analysis?.missing;
  const duplicates = analysis?.duplicates;
  const outliers = analysis?.outliers;
  const imbalance = analysis?.class_imbalance;

  const warnings = useMemo(() => {
    const list: { level: 'error' | 'warning' | 'info'; title: string; detail: string }[] = [];
    const target = analysis?.target;

    const corr = analysis?.correlation;
    if (target && corr?.top_correlations) {
      const nearPerfect = corr.top_correlations.filter((p) => Math.abs(p.value) > 0.95 && (p.x === target || p.y === target));
      if (nearPerfect.length > 0) {
        const pair = nearPerfect[0];
        list.push({
          level: 'error',
          title: 'Potential target leakage',
          detail: `“${pair.x === target ? pair.y : pair.x}” is near-perfectly correlated with target “${target}” (r = ${pair.value.toFixed(3)}). Strongly consider dropping it before training.`,
        });
      }
    }

    const idCols: string[] = [];
    for (const c of profile?.column_details || []) {
      const isId = /(^id$|_id$|\.id$|^index$)/.test(c.name.toLowerCase());
      if (isId || (c.unique_values != null && profile?.rows && c.unique_values === profile.rows && c.name !== target)) {
        idCols.push(c.name);
      }
    }
    if (idCols.length) {
      list.push({
        level: 'info',
        title: 'Identifier-like columns detected',
        detail: `${idCols.slice(0, 5).join(', ')}${idCols.length > 5 ? ` (+${idCols.length - 5} more)` : ''} — unique per row, low predictive value. Consider excluding them from training.`,
      });
    }

    if (duplicates?.count && duplicates.count > 0) {
      list.push({
        level: 'warning',
        title: 'Duplicate rows found',
        detail: `${duplicates.count.toLocaleString()} duplicate rows (${duplicates.pct}%). Duplicates can bias evaluation metrics.`,
      });
    }

    if (imbalance?.detected && imbalance.severity === 'high') {
      list.push({
        level: 'error',
        title: 'Severe class imbalance',
        detail: `Target “${imbalance.target}” has a ${imbalance.imbalance_ratio}x majority/minority ratio. Consider SMOTE or class weights.`,
      });
    }

    return list;
  }, [analysis, profile, duplicates, imbalance]);

  const componentOrder: { key: string; label: string }[] = [
    { key: 'missing_data', label: 'Completeness' },
    { key: 'duplicates', label: 'Uniqueness' },
    { key: 'outliers', label: 'Validity' },
    { key: 'class_balance', label: 'Class Balance' },
  ];

  const cleanCount = (warnings.filter((w) => w.level === 'error').length * 2) + (warnings.filter((w) => w.level === 'warning').length);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-6">
          <QualityGauge score={qs?.total ?? 0} grade={qs?.grade} label="Overall Quality" />
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Data Quality Assessment</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Computed automatically from missing values, duplicates, outliers and class balance.</p>
            </div>
            <div className="space-y-2">
              {componentOrder.map((c) => {
                const v = qs?.components?.[c.key] ?? 0;
                return (
                  <div key={c.key} className="flex items-center gap-2">
                    <span className="w-28 text-[10px] text-zinc-500 uppercase tracking-wide">{c.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, backgroundColor: gradeColor(qs?.grade || 'C') }} />
                    </div>
                    <span className="w-10 text-right text-[11px] font-mono text-zinc-400">{Math.round(v)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              {warnings.length > 0 ? <ShieldAlert className="w-4 h-4 text-amber-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
              Flags & Warnings
            </h3>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', warnings.length ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20')}>
              {warnings.length ? `${warnings.length} flagged` : 'Clean'}
            </span>
          </div>
          {warnings.length === 0 ? (
            <p className="text-sm text-zinc-500">No data quality issues detected. This dataset looks ready for modeling.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {warnings.map((w, i) => (
                <div key={i} className={cn('rounded-lg border px-3 py-2.5', w.level === 'error' ? 'border-red-500/20 bg-red-500/[0.05]' : w.level === 'warning' ? 'border-amber-500/20 bg-amber-500/[0.05]' : 'border-sky-500/20 bg-sky-500/[0.05]')}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: w.level === 'error' ? '#f87171' : w.level === 'warning' ? '#fbbf24' : '#7dd3fc' }}>
                    {w.level === 'error' ? <CircleAlert className="w-3.5 h-3.5" /> : w.level === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {w.title}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{w.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Missing Value Matrix</h4>
          <MissingMatrix columns={preview?.columns || dataset.columns} rows={preview?.rows || []} maxRows={30} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Missing by Column</h4>
          {!missing || missing.columns.length === 0 ? (
            <p className="text-sm text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> No missing values</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {missing.columns.slice(0, 10).map((c) => (
                <div key={c.column} className="flex items-center gap-2">
                  <span className="w-32 truncate font-mono text-[11px] text-zinc-300">{c.column}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.pct)}%`, backgroundColor: severityHex(c.pct > 20 ? 'high' : c.pct > 5 ? 'medium' : 'low') }} />
                  </div>
                  <span className="w-16 text-right text-[10px] font-mono text-zinc-400">{fmtPct(c.pct)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Overall</span>
            <span className="font-mono text-zinc-300">{missing ? `${fmtPct(missing.missing_pct)} · ${missing.total_missing.toLocaleString()} cells` : '…'}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <Layers className="w-4 h-4 text-primary" /> Duplicate Rows
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: severityHex(duplicates?.severity || 'low') }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: severityHex(duplicates?.severity || 'low') }} />
              {severityLabel(duplicates?.severity || 'low')}
            </span>
          </div>
          <div className="text-lg font-mono font-semibold text-zinc-100">{duplicates ? `${duplicates.count.toLocaleString()} rows (${duplicates.pct}%)` : '…'}</div>

          <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <CircleAlert className="w-4 h-4 text-amber-400" /> Outliers
            </div>
            <span className="text-[10px]" style={{ color: severityHex(outliers?.mean_pct && outliers.mean_pct > 5 ? 'medium' : 'low') }}>{outliers?.mean_pct && outliers.mean_pct > 5 ? 'Flagged' : 'Low'}</span>
          </div>
          <div className="text-lg font-mono font-semibold text-zinc-100">{outliers ? `${outliers.total_outliers.toLocaleString()} values · ${outliers.mean_pct}% avg` : '…'}</div>

          <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <BarChart3 className="w-4 h-4 text-fuchsia-400" /> Class Balance
            </div>
            <span className="text-[10px]" style={{ color: severityHex(imbalance?.severity || 'low') }}>{imbalance?.detected ? severityLabel(imbalance.severity || 'low') : 'N/A'}</span>
          </div>
          <div className="text-lg font-mono font-semibold text-zinc-100">
            {imbalance?.detected ? `${imbalance.imbalance_ratio}x ratio · ${imbalance.classes} classes` : 'Not applicable'}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Wand2 className="w-4 h-4" /></div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">Ready to clean?</h4>
            <p className="text-xs text-zinc-500">{cleanCount > 0 ? `Resolve ${cleanCount} flagged issue${cleanCount > 1 ? 's' : ''} before training for best results.` : 'No outstanding issues — you can proceed to modeling.'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onQuickAction(`/app/cleaning?dataset=${encodeURIComponent(dataset.name)}`)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
          >
            <Wand2 className="w-4 h-4" /> Open Data Cleaning
          </button>
          <button
            onClick={() => onQuickAction(`/app/profiling?dataset=${encodeURIComponent(dataset.name)}`)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-zinc-300 hover:border-primary/40 transition-colors inline-flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" /> Data Profiling
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
