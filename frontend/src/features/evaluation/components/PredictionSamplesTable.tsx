import { memo, useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Check, X, ArrowUpDown } from 'lucide-react';
import type { PredictionSample, TaskType } from '../services/evaluation.service';
import { ChartCard } from './ChartCard';

const PAGE_SIZE = 10;

type SortKey = 'actual' | 'predicted' | 'residual';

interface Props {
  data: PredictionSample[];
  taskType: TaskType;
  totalRows: number;
}

export const PredictionSamplesTable = memo(function PredictionSamplesTable({
  data,
  taskType,
  totalRows,
}: Props) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((s) => String(s.actual).toLowerCase().includes(q) || String(s.predicted).toLowerCase().includes(q));
  }, [data, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const correct = data.filter((s) => s.correct === true).length;
  const wrong = data.filter((s) => s.correct === false).length;
  const meanAbsError = useMemo(() => {
    const errs = data.map((s) => (typeof s.residual === 'number' ? Math.abs(s.residual) : s.abs_error)).filter((v): v is number => typeof v === 'number');
    return errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null;
  }, [data]);

  const stats =
    taskType === 'classification'
      ? [
          { label: 'Correct', value: String(correct) },
          { label: 'Incorrect', value: String(wrong) },
        ]
      : meanAbsError != null
        ? [{ label: 'Mean abs error', value: meanAbsError.toFixed(4) }]
        : undefined;

  return (
    <ChartCard
      title="Prediction samples"
      subtitle={`${data.length.toLocaleString()} of ${totalRows.toLocaleString()} test rows shown, sampled deterministically`}
      stats={stats}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Filter by actual or predicted value"
              aria-label="Filter prediction samples"
              className="w-full rounded bg-card border border-border pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
            />
          </div>
        </div>

        {!rows.length ? (
          <div className="grid place-items-center text-sm text-zinc-500 py-8">
            No prediction sample matches that filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <SortableHeader label="Actual" sortKey="actual" taskType={taskType} sort={sort} onSort={setSort} />
                  <SortableHeader label="Predicted" sortKey="predicted" taskType={taskType} sort={sort} onSort={setSort} />
                  {taskType === 'classification' ? (
                    <th className="py-2 pr-3 font-medium text-zinc-400">Probability</th>
                  ) : (
                    <>
                      <SortableHeader label="Residual" sortKey="residual" taskType={taskType} sort={sort} onSort={setSort} />
                      <th className="py-2 pr-3 font-medium text-zinc-400">Abs error</th>
                    </>
                  )}
                  <th className="py-2 pl-3 font-medium text-zinc-400">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <tr key={`${safePage}-${i}`} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3 font-mono text-zinc-200">{fmt(s.actual)}</td>
                    <td className="py-2 pr-3 font-mono text-zinc-200">{fmt(s.predicted)}</td>
                    {taskType === 'classification' ? (
                      <td className="py-2 pr-3 text-zinc-400">
                        {s.probability ? (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(s.probability).map(([label, p]) => (
                              <span
                                key={label}
                                className="rounded bg-surface border border-border px-1.5 py-0.5 text-xs tabular-nums"
                                title={`P(${label}) = ${p}`}
                              >
                                {label}: {p.toFixed(2)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-600">not available</span>
                        )}
                      </td>
                    ) : (
                      <>
                        <td className="py-2 pr-3 font-mono tabular-nums text-zinc-300">
                          {s.residual != null ? s.residual.toFixed(4) : '—'}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums text-zinc-400">
                          {s.abs_error != null ? s.abs_error.toFixed(4) : '—'}
                        </td>
                      </>
                    )}
                    <td className="py-2 pl-3">
                      {taskType === 'classification' ? (
                        s.correct ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-success)]">
                            <Check className="w-3.5 h-3.5" /> correct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-danger)]">
                            <X className="w-3.5 h-3.5" /> wrong
                          </span>
                        )
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
            <span>
              Page {safePage + 1} of {pageCount}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 0}
                className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:border-[rgba(255,255,255,0.22)]"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= pageCount - 1}
                className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:border-[rgba(255,255,255,0.22)]"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </ChartCard>
  );
});

function fmt(v: string | number): string {
  return typeof v === 'number' ? v.toFixed(4) : String(v);
}

function SortableHeader({
  label,
  sortKey,
  taskType,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  taskType: TaskType;
  sort: { key: SortKey; dir: 'asc' | 'desc' } | null;
  onSort: (s: { key: SortKey; dir: 'asc' | 'desc' } | null) => void;
}) {
  if (taskType === 'classification' && sortKey === 'residual') return null;
  const active = sort?.key === sortKey;
  return (
    <th className="py-2 pr-3 font-medium text-zinc-400">
      <button
        type="button"
        onClick={() =>
          onSort(
            active && sort.dir === 'asc'
              ? { key: sortKey, dir: 'desc' }
              : active
                ? null
                : { key: sortKey, dir: 'asc' },
          )
        }
        className="inline-flex items-center gap-1 transition-colors hover:text-zinc-200"
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'text-zinc-200' : 'text-zinc-600'}`} />
      </button>
    </th>
  );
}
