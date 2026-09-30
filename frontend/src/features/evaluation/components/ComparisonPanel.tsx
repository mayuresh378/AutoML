import { memo } from 'react';
import { GitCompare, AlertTriangle, Trophy } from 'lucide-react';
import type { ModelComparisonResult, TaskType } from '../services/evaluation.service';
import { ChartCard } from './ChartCard';
import { formatMetric, metricsForTask, primaryMetricKey } from '../utils/metrics';

interface Props {
  results: ModelComparisonResult[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
}

export const ComparisonPanel = memo(function ComparisonPanel({
  results,
  isLoading,
  isError,
  errorMessage,
  onRetry,
}: Props) {
  if (isLoading) {
    return (
      <ChartCard title="Model comparison" subtitle="One shared test set">
        <div className="min-h-[160px] grid place-items-center text-sm text-zinc-500">
          Evaluating selected models on a shared test set…
        </div>
      </ChartCard>
    );
  }

  if (isError) {
    return (
      <ChartCard title="Model comparison" subtitle="One shared test set">
        <div className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-4 text-sm text-[var(--color-text-secondary)] flex items-center justify-between gap-3 flex-wrap">
          <span>{errorMessage ?? 'The comparison could not be completed.'}</span>
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-border px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-[rgba(255,255,255,0.22)]"
          >
            Retry
          </button>
        </div>
      </ChartCard>
    );
  }

  if (!results.length) return null;

  const ok = results.filter((r) => !r.error && r.metrics);
  const failed = results.filter((r) => r.error);
  const taskType = (results.find((r) => !r.error)?.task_type ?? 'classification') as TaskType;
  const defs = metricsForTask(taskType);
  const primary = primaryMetricKey(taskType);

  // Rank on the task's headline metric, highest first.
  const ranked = [...ok].sort(
    (a, b) => ((b.metrics?.[primary] as number) ?? -Infinity) - ((a.metrics?.[primary] as number) ?? -Infinity),
  );
  const bestName = ranked.length ? ranked[0].model_name : null;

  return (
    <ChartCard
      title="Model comparison"
      subtitle="All models evaluated on the same held-out rows, so the scores are directly comparable"
      stats={failed.length ? [{ label: 'Failed', value: String(failed.length) }] : undefined}
    >
      <div className="flex flex-col gap-4">
        {failed.length > 0 && (
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {failed.map((r) => (
              <li
                key={r.model_name}
                className="flex items-start gap-2 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
              >
                <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[var(--color-text)] font-medium">{r.model_name}</strong>{' '}
                  {r.error}
                </span>
              </li>
            ))}
          </ul>
        )}

        {ok.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3 font-medium text-zinc-400">Model</th>
                  {defs.map((d) => (
                    <th
                      key={d.key}
                      className="py-2 pr-3 font-medium text-zinc-400 whitespace-nowrap"
                      title={d.hint}
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => (
                  <tr
                    key={r.model_name}
                    className="border-b border-border/50 last:border-0"
                    data-best={r.model_name === bestName}
                  >
                    <td className="py-2 pr-3 text-zinc-200 max-w-[240px]">
                      <span className="inline-flex items-center gap-1.5 truncate">
                        {r.model_name === bestName && (
                          <Trophy className="w-3.5 h-3.5 text-[var(--color-warning)] shrink-0" />
                        )}
                        <span className="truncate">{r.model_name}</span>
                      </span>
                    </td>
                    {defs.map((d) => {
                      const v = r.metrics?.[d.key];
                      return (
                        <td
                          key={d.key}
                          className="py-2 pr-3 font-mono tabular-nums whitespace-nowrap"
                          style={{
                            color:
                              d.key === primary && r.model_name === bestName
                                ? 'var(--color-success)'
                                : v == null
                                  ? 'var(--color-text-tertiary)'
                                  : 'var(--color-text-secondary)',
                          }}
                        >
                          {v == null ? '—' : formatMetric(v as number, d.digits)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid place-items-center gap-2 py-8 text-sm text-zinc-500">
            <GitCompare className="w-5 h-5" />
            None of the selected models could be evaluated.
          </div>
        )}
      </div>
    </ChartCard>
  );
});
