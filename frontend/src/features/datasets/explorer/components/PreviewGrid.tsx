import { useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type Table,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnSizingState,
  type ColumnPinningState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import {
  Search,
  X,
  Copy,
  Download,
  Columns3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Loader2,
  RefreshCw,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';
import { useExplorerPreview } from '../hooks';
import { getErrorMessage } from '../../../../services/http';
import { dtypeMeta, exportRowsToCsv, copyRowsToClipboard, fmt, stripExtension } from '../utils';
import { Pagination } from '../../../../components/ui/Pagination';
import { cn } from '../../../../lib/cn';
import type { DatasetAnalysisResult, DatasetProfile } from '../types';

interface PreviewGridProps {
  dataset: string;
  onSelectColumn: (col: string) => void;
  selectedColumn?: string | null;
  profile?: DatasetProfile | null;
  analysis?: DatasetAnalysisResult | null;
}

type RowRecord = Record<string, any>;

export function PreviewGrid({ dataset, onSelectColumn, selectedColumn, profile, analysis }: PreviewGridProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState('');
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: ['__index'] });
  const [copied, setCopied] = useState(false);

  const { data: preview, isLoading, isError, error, refetch } = useExplorerPreview(
    dataset,
    pageSize,
    pageIndex * pageSize,
  );

  useEffect(() => {
    const t = setTimeout(() => setGlobalFilter(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const columns = useMemo<ColumnDef<RowRecord, any>[]>(() => {
    const cols = preview?.columns ?? [];
    const defs: ColumnDef<RowRecord, any>[] = [
      {
        id: '__index',
        header: '#',
        size: 56,
        enableResizing: false,
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="text-zinc-600 font-mono text-xs">{pageIndex * pageSize + row.index + 1}</span>
        ),
      },
      ...cols.map((col): ColumnDef<RowRecord, any> => {
        const meta = dtypeMeta(preview?.dtypes?.[col], col);
        const numeric = meta.kind === 'numeric';
        return {
          id: col,
          accessorKey: col,
          header: col,
          size: 190,
          enableSorting: true,
          cell: ({ getValue }) => {
            const v = getValue() as any;
            return v == null || v === '' ? (
              <span className="text-zinc-600 italic text-xs">NULL</span>
            ) : (
              <span
                title={String(v)}
                className={cn('font-mono text-[13px]', numeric && 'tabular-nums', numeric ? 'text-zinc-100' : 'text-zinc-300')}
              >
                {String(v)}
              </span>
            );
          },
        };
      }),
    ];
    return defs;
  }, [preview?.columns, preview?.dtypes, pageIndex, pageSize]);

  const table = useReactTable({
    data: preview?.rows ?? [],
    columns,
    state: { sorting, globalFilter, columnFilters, columnVisibility, columnSizing, columnPinning },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });

  const rows = table.getFilteredRowModel().rows;
  const activeFilterCount = columnFilters.length;

  async function handleCopy() {
    try {
      await copyRowsToClipboard(rows.map((r) => r.original));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  const totalPages = Math.max(1, Math.ceil((preview?.total ?? 0) / pageSize));
  const from = preview?.total ? pageIndex * pageSize + 1 : 0;
  const to = preview?.total ? Math.min((pageIndex + 1) * pageSize, preview.total) : 0;
  const colIds = preview?.columns ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-card">
      {/* Column insight cards */}
      <ColumnHeaderCards
        columns={colIds}
        dtypes={preview?.dtypes}
        profile={profile}
        analysis={analysis}
        selectedColumn={selectedColumn}
        onSelectColumn={onSelectColumn}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search loaded rows…"
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] pl-8 pr-8 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/40"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <FilterPopover
            columnIds={colIds}
            columnFilters={columnFilters}
            onChange={setColumnFilters}
            activeCount={activeFilterCount}
          />

          <ColumnVisibilityPopover table={table} previewColumnCount={colIds.length} />

          <button onClick={handleCopy} title="Copy loaded rows" className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-cyan-400/40 hover:text-zinc-100 transition-colors">
            {copied ? <span className="text-emerald-400">Copied</span> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>

          <button
            onClick={() => exportRowsToCsv(rows.map((r) => r.original), `${stripExtension(dataset)}-preview.csv`)}
            title="Export loaded rows as CSV"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-cyan-400/40 hover:text-zinc-100 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          <button onClick={() => refetch()} title="Refresh preview" className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-cyan-400/40 hover:text-zinc-100 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[62vh]">
        <table className="border-collapse" style={{ width: table.getTotalSize(), minWidth: '100%' }}>
          <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-white/[0.08] bg-surface">
                {hg.headers.map((header) => {
                  const pinned = header.column.getIsPinned();
                  const colId = header.column.id;
                  const meta = dtypeMeta(preview?.dtypes?.[colId], colId);
                  const sortDir = header.column.getIsSorted();
                  const numeric = colId !== '__index' && meta.kind === 'numeric';
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className={cn(
                        'relative px-3 py-2.5 align-bottom border-r border-white/[0.04] select-none',
                        numeric ? 'text-right' : 'text-left',
                        pinned === 'left' && 'sticky left-0 z-30 bg-surface border-r border-white/[0.10]',
                        colId !== '__index' && colId === selectedColumn && 'bg-cyan-400/[0.08]',
                      )}
                    >
                      {colId === '__index' ? (
                        <span className="text-xs font-semibold text-zinc-500">#</span>
                      ) : (
                        <div className={cn('flex flex-col gap-1 min-w-0', numeric && 'items-end')}>
                          <div className={cn('flex items-center gap-1 min-w-0', numeric && 'flex-row-reverse')}>
                            <span className="flex items-center gap-1 min-w-0">
                              <meta.Icon className="w-3 h-3 shrink-0" style={{ color: meta.hex }} />
                              <button
                                onClick={() => onSelectColumn(colId)}
                                title="Inspect column"
                                className={cn(
                                  'text-xs font-semibold uppercase tracking-wider truncate max-w-[150px]',
                                  colId === selectedColumn ? 'text-cyan-300' : 'text-zinc-300 hover:text-zinc-100',
                                )}
                              >
                                {colId}
                              </button>
                            </span>
                            {header.column.getCanSort() && (
                              <button
                                onClick={header.column.getToggleSortingHandler()}
                                className={cn('shrink-0 text-zinc-600 hover:text-zinc-300', sortDir && 'text-cyan-300')}
                                title="Sort"
                              >
                                {sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : sortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3" />}
                              </button>
                            )}
                            <button
                              onClick={() => onSelectColumn(colId)}
                              className="shrink-0 text-zinc-600 hover:text-cyan-300"
                              title="View column details"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                          <span className={cn('inline-flex w-fit items-center rounded-full border px-1.5 py-px text-[9px] font-medium', meta.cls, numeric && 'mr-auto')}>
                            {meta.label}
                          </span>
                        </div>
                      )}
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-cyan-400/60',
                          header.column.getIsResizing() && 'bg-cyan-400',
                        )}
                      />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading && !preview ? (
              <tr>
                <td colSpan={table.getAllColumns().length}>
                  <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading preview…</span>
                  </div>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={table.getAllColumns().length}>
                  <div className="flex flex-col items-center justify-center py-14 gap-3">
                    <span className="text-sm text-red-400">{getErrorMessage(error)}</span>
                    <button onClick={() => refetch()} className="text-xs text-cyan-300 hover:underline">Try again</button>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllColumns().length}>
                  <div className="py-14 text-center">
                    <FileSpreadsheet className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">
                      {globalFilter || activeFilterCount > 0
                        ? 'No rows match your search or filters on this page.'
                        : 'No rows in this page.'}
                    </p>
                    {(globalFilter || activeFilterCount > 0) && (
                      <button
                        onClick={() => { setSearchInput(''); setColumnFilters([]); }}
                        className="mt-3 text-xs text-cyan-300 hover:underline"
                      >
                        Clear search & filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-white/[0.04] hover:bg-cyan-400/[0.03] transition-colors">
                  {row.getVisibleCells().map((cell) => {
                    const pinned = cell.column.getIsPinned();
                    const cellMeta = dtypeMeta(preview?.dtypes?.[cell.column.id], cell.column.id);
                    const isColSelected = cell.column.id !== '__index' && cell.column.id === selectedColumn;
                    return (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={cn(
                          'px-3 py-2 whitespace-nowrap max-w-[320px] overflow-hidden text-ellipsis border-r border-white/[0.03]',
                          cellMeta.kind === 'numeric' && 'text-right tabular-nums',
                          pinned === 'left' && 'sticky left-0 z-10 bg-card border-r border-white/[0.10]',
                          isColSelected && 'bg-cyan-400/[0.05]',
                        )}
                      >
                        {cell.column.id === '__index' ? (
                          cell.renderValue() as React.ReactNode
                        ) : cell.renderValue() == null || cell.renderValue() === '' ? (
                          <span className="text-zinc-600 italic text-xs">NULL</span>
                        ) : (
                          <span className="font-mono text-[13px] text-zinc-300">{String(cell.renderValue())}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>
            Showing <span className="text-zinc-200 font-medium">{from.toLocaleString()}–{to.toLocaleString()}</span> of{' '}
            <span className="text-zinc-200 font-medium">{(preview?.total ?? 0).toLocaleString()}</span> rows
          </span>
          <label className="flex items-center gap-1.5">
            <span className="text-zinc-600">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
              className="rounded bg-card border border-white/[0.08] px-1.5 py-0.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-400/40"
              style={{ colorScheme: 'dark' }}
            >
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <Pagination
          currentPage={pageIndex + 1}
          totalPages={totalPages}
          onPageChange={(p) => setPageIndex(p - 1)}
        />
      </div>
    </div>
  );
}

/* ---------------------------- Column header cards ---------------------------- */

function ColumnHeaderCards({
  columns, dtypes, profile, analysis, selectedColumn, onSelectColumn,
}: {
  columns: string[];
  dtypes?: Record<string, string>;
  profile?: DatasetProfile | null;
  analysis?: DatasetAnalysisResult | null;
  selectedColumn?: string | null;
  onSelectColumn: (col: string) => void;
}) {
  if (columns.length === 0) return null;
  const details = profile?.column_details || [];

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-2 border-b border-white/[0.06] bg-white/[0.01]">
      {columns.map((col) => {
        const meta = dtypeMeta(dtypes?.[col], col);
        const colProfile = details.find((d) => d.name === col);
        const hist = analysis?.distributions?.columns?.find((h) => h.column === col);
        const unique = colProfile?.unique_values;
        return (
          <button
            key={col}
            onClick={() => onSelectColumn(col)}
            className={cn(
              'w-40 shrink-0 rounded-xl border bg-white/[0.02] p-2.5 text-left transition-all',
              selectedColumn === col
                ? 'border-cyan-400/50 bg-cyan-400/[0.06]'
                : 'border-white/[0.06] hover:border-cyan-400/30 hover:bg-white/[0.04]',
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1 min-w-0">
                <meta.Icon className="w-3 h-3 shrink-0" style={{ color: meta.hex }} />
                <span className={cn('truncate font-mono text-[11px] font-medium', selectedColumn === col ? 'text-cyan-300' : 'text-zinc-200')}>
                  {col}
                </span>
              </span>
              <span className={cn('shrink-0 inline-flex items-center rounded-full border px-1 py-px text-[8px] font-semibold uppercase tracking-wide', meta.kind === 'numeric' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20')}>
                {meta.kind === 'numeric' ? 'num' : 'cat'}
              </span>
            </div>
            {unique != null && (
              <div className="mt-1 text-[9px] text-zinc-500">{fmt.num(unique)} unique</div>
            )}
            <Sparkline
              bins={meta.kind === 'numeric' ? hist?.bins : undefined}
              topValues={meta.kind === 'numeric' ? undefined : colProfile?.top_values}
              hex={meta.hex}
            />
          </button>
        );
      })}
    </div>
  );
}

function Sparkline({
  bins, topValues, hex,
}: {
  bins?: number[];
  topValues?: Record<string, number>;
  hex: string;
}) {
  const values: number[] = bins && bins.length ? bins : topValues ? Object.values(topValues).slice(0, 10) : [];
  if (values.length === 0) {
    return <div className="mt-1 h-6 flex items-center text-[9px] text-zinc-600">—</div>;
  }
  const max = Math.max(...values, 1);
  const step = Math.max(1, Math.round(values.length / 24));
  const downsampled = values.filter((_, i) => i % step === 0).slice(0, 24);
  return (
    <div className="mt-1 flex items-end gap-[2px] h-6">
      {downsampled.map((v, i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm"
          style={{ height: `${Math.max(10, (v / max) * 100)}%`, backgroundColor: hex, opacity: 0.3 + 0.7 * (v / max) }}
        />
      ))}
    </div>
  );
}

/* ---------------------------- Filters popover ---------------------------- */

function FilterPopover({
  columnIds, columnFilters, onChange, activeCount,
}: {
  columnIds: string[];
  columnFilters: ColumnFiltersState;
  onChange: (filters: ColumnFiltersState) => void;
  activeCount: number;
}) {
  return (
    <details className="relative group">
      <summary className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-cyan-400/40 hover:text-zinc-100 cursor-pointer list-none">
        <Filter className="w-3.5 h-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-cyan-400/20 text-cyan-300 text-[9px] font-bold">{activeCount}</span>
        )}
      </summary>
      <div className="absolute right-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto rounded-xl border border-white/[0.10] bg-[#101014] shadow-dropdown z-40 p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Filter by column</span>
          {activeCount > 0 && (
            <button onClick={() => onChange([])} className="text-[10px] text-cyan-300 hover:underline">
              Clear all
            </button>
          )}
        </div>
        <div className="space-y-2">
          {columnIds.map((col) => {
            const current = columnFilters.find((f) => f.id === col)?.value as string | undefined;
            return (
              <label key={col} className="block">
                <span className="block font-mono text-[10px] text-zinc-400 mb-1 truncate">{col}</span>
                <input
                  value={current ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChange(
                      v
                        ? [...columnFilters.filter((f) => f.id !== col), { id: col, value: v }]
                        : columnFilters.filter((f) => f.id !== col),
                    );
                  }}
                  placeholder="Filter values…"
                  className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/40"
                />
              </label>
            );
          })}
        </div>
      </div>
    </details>
  );
}

/* ---------------------------- Column visibility popover ---------------------------- */

function ColumnVisibilityPopover({
  table, previewColumnCount,
}: {
  table: Table<RowRecord>;
  previewColumnCount: number;
}) {
  return (
    <details className="relative group">
      <summary className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-cyan-400/40 hover:text-zinc-100 cursor-pointer list-none">
        <Columns3 className="w-3.5 h-3.5" />
        Columns
        <span className="text-zinc-500">{Object.values(table.getState().columnVisibility).filter((v) => v !== false).length} / {previewColumnCount}</span>
      </summary>
      <div className="absolute right-0 top-full mt-1.5 w-56 max-h-72 overflow-y-auto rounded-lg border border-white/[0.10] bg-[#101014] shadow-dropdown z-30 p-2">
        <div className="flex items-center justify-between px-1 pb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Toggle columns</span>
          <button onClick={() => table.setColumnVisibility({})} className="text-[10px] text-cyan-300 hover:underline">
            Reset
          </button>
        </div>
        {table.getAllLeafColumns().map((col) => (
          <label key={col.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-white/[0.04] cursor-pointer">
            <input
              type="checkbox"
              checked={col.getIsVisible()}
              onChange={col.getToggleVisibilityHandler()}
              className="accent-cyan-400"
            />
            <span className="text-xs text-zinc-300 truncate">{col.id === '__index' ? '# (row index)' : col.id}</span>
          </label>
        ))}
      </div>
    </details>
  );
}