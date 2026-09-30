import { memo } from 'react';
import { History, ChevronLeft, ChevronRight, Search, Loader2, ExternalLink } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import type { EvaluationRecordItem, TaskType } from '../services/evaluation.service';
import { formatMetric, metricsForTask, primaryMetricKey } from '../utils/metrics';

const PAGE_SIZE = 10;

interface Props {
  items: EvaluationRecordItem[];
  total: number;
  offset: number;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  search: string;
  sortBy: string;
  order: 'asc' | 'desc';
  activeId?: string;
  onPageChange: (offset: number) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (sortBy: string, order: 'asc' | 'desc') => void;
  onSelect: (id: string) => void;
  onRetry: () => void;
}

export const EvaluationHistoryPanel = memo(function EvaluationHistoryPanel({
  items,
  total,
  offset,
  isLoading,
  isFetching,
  isError,
  search,
  sortBy,
  order,
  activeId,
  onPageChange,
  onSearchChange,
  onSortChange,
  onSelect,
  onRetry,
}: Props) {
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="rounded-[var(--radius-xl)] border border-border bg-[var(--color-elevated)] p-6 flex flex-col gap-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-[var(--radius-lg)] bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.24)] shrink-0">
            <History className="w-[17px] h-[17px] text-[#a5b4fc]" />
          </span>
          <div>
            <h2 className="m-0 mb-0.5 text-[var(--text-title-sm)] font-semibold text-[var(--color-text)]">
              Evaluation history
            </h2>
            <p className="m-0 text-sm text-[var(--color-text-tertiary)]">
              {total.toLocaleString()} saved run{total === 1 ? '' : 's'}, newest first
              {isFetching && !isLoading ? ' · updating' : ''}
            </p>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search model, dataset or target"
            aria-label="Search evaluation history"
            className="w-full rounded bg-card border border-border pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value, order)}
          aria-label="Sort history by"
          style={{ colorScheme: 'dark' }}
          className="rounded bg-card border border-border px-3 py-2 text-sm text-zinc-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="created_at">Date</option>
          <option value="model_name">Model</option>
          <option value="dataset_name">Dataset</option>
          <option value="target_column">Target</option>
          <option value="task_type">Task</option>
        </select>
        <button
          type="button"
          onClick={() => onSortChange(sortBy, order === 'asc' ? 'desc' : 'asc')}
          aria-label={`Sort ${order === 'asc' ? 'descending' : 'ascending'}`}
          className="rounded border border-border px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-[rgba(255,255,255,0.22)] hover:text-white"
        >
          {order === 'asc' ? 'Asc' : 'Desc'}
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center gap-3 py-10 text-sm text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading evaluation history
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-4 text-sm text-[var(--color-text-secondary)] flex items-center justify-between gap-3 flex-wrap">
          <span>Evaluation history could not be loaded.</span>
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-border px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-[rgba(255,255,255,0.22)]"
          >
            Retry
          </button>
        </div>
      ) : !items.length ? (
        <EmptyState
          title={search ? 'No runs match that search' : 'No evaluations yet'}
          description={
            search
              ? 'Try a different model, dataset or target name.'
              : 'Run an evaluation above and it will be saved here automatically.'
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3 font-medium text-zinc-400">Model</th>
                  <th className="py-2 pr-3 font-medium text-zinc-400">Dataset / target</th>
                  <th className="py-2 pr-3 font-medium text-zinc-400">Task</th>
                  <th className="py-2 pr-3 font-medium text-zinc-400">Score</th>
                  <th className="py-2 pr-3 font-medium text-zinc-400">When</th>
                  <th className="py-2 font-medium text-zinc-400" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const task = (item.task_type || 'classification') as TaskType;
                  const key = primaryMetricKey(task);
                  const score = item.metrics?.[key];
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-border/50 last:border-0 transition-colors hover:bg-surface-hover ${
                        activeId === item.id ? 'bg-surface-hover' : ''
                      }`}
                    >
                      <td className="py-2 pr-3 text-zinc-200 max-w-[220px] truncate">{item.model_name}</td>
                      <td className="py-2 pr-3 text-zinc-400">
                        <div className="max-w-[220px] truncate">{item.dataset_name}</div>
                        <div className="text-xs text-zinc-600 truncate">{item.target_column}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-400">
                          {task}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums text-zinc-200">
                        {score != null ? formatMetric(score) : '—'}
                        <span className="ml-1.5 text-[11px] text-zinc-600">
                          {metricsForTask(task).find((m) => m.key === key)?.short}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-zinc-500 whitespace-nowrap">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => onSelect(item.id)}
                          className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-[rgba(255,255,255,0.22)] hover:text-white whitespace-nowrap"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
              <span>
                Page {page} of {pageCount}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:border-[rgba(255,255,255,0.22)]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  type="button"
                  onClick={() => onPageChange(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                  className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:border-[rgba(255,255,255,0.22)]"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
});
