import { useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type Table,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnSizingState,
  type ColumnPinningState,
  type ColumnFiltersState,
  type RowSelectionState,
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
  RefreshCw,
  Filter,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { useExplorerPreview } from '../hooks';
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

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60';

export function PreviewGrid({ dataset, onSelectColumn, selectedColumn, profile, analysis }: PreviewGridProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState('');
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: ['__select', '__index'] });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [copied, setCopied] = useState(false);

  const { data: preview, isLoading, isError, refetch } = useExplorerPreview(
    dataset,
    pageSize,
    pageIndex * pageSize,
  );

  useEffect(() => {
    const t = setTimeout(() => setGlobalFilter(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPageIndex(0);
    setRowSelection({});
    setSearchInput('');
    setGlobalFilter('');
    setColumnFilters([]);
  }, [dataset]);

  const columns = useMemo<ColumnDef<RowRecord, any>[]>(() => {
    const cols = preview?.columns ?? [];
    const defs: ColumnDef<RowRecord, any>[] = [
      {
        id: '__select',
        size: 44,
        enableResizing: false,
        enableSorting: false,
        enableGlobalFilter: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all rows on this page"
            ref={(el: HTMLInputElement | null) => {
              if (el) el.indeterminate = table.getIsSomePageRowsSelected();
            }}
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="accent-blue-500 cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select row ${(row.index + 1).toLocaleString()}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="accent-blue-500 cursor-pointer"
          />
        ),
      },
      {
        id: '__index',
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
                className={cn(
                  'font-mono text-[13px]',
                  numeric && 'tabular-nums',
                  numeric ? 'text-zinc-200' : 'text-zinc-400',
                )}
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
    state: { sorting, globalFilter, columnFilters, columnVisibility, columnSizing, columnPinning, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: setColumnPinning,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });

  const rows = table.getFilteredRowModel().rows;
  const activeFilterCount = columnFilters.length;
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  async function handleCopy() {
    try {
      await copyRowsToClipboard(rows.map((r) => r.original));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }

  const totalPages = Math.max(1, Math.ceil((preview?.total ?? 0) / pageSize));
  const from = preview?.total ? pageIndex * pageSize + 1 : 0;
  const to = preview?.total ? Math.min((pageIndex + 1) * pageSize, preview.total) : 0;
  const colIds = preview?.columns ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-card">
      <ColumnHeaderCards
        columns={colIds}
        dtypes={preview?.dtypes}
        profile={profile}
        analysis={analysis}
        selectedColumn={selectedColumn}
        onSelectColumn={onSelectColumn}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.08] px-5 py-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search columns…"
            aria-label="Search loaded rows"
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] pl-9 pr-8 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <FilterPopover
            columnIds={colIds}
            columnFilters={columnFilters}
            onChange={setColumnFilters}
            activeCount={activeFilterCount}
          />

          <ColumnVisibilityPopover table={table} previewColumnCount={colIds.length} />

          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
              aria-label="Rows per page"
              className={cn('rounded-md bg-white/[0.04] border border-white/[0.08] px-1.5 py-1.5 text-xs text-zinc-300', focusRing)}
              style={{ colorScheme: 'dark' }}
            >
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <button
            onClick={handleCopy}
            title="Copy loaded rows to clipboard"
            aria-label="Copy loaded rows to clipboard"
            className={cn('inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:border-white/[0.16] transition-colors', focusRing)}
          >
            {copied ? <span className="text-emerald-400">Copied</span> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>

          <button
            onClick={() =>
              exportRowsToCsv(
                (selectedCount > 0 ? selectedRows : rows).map((r) => r.original),
                `${stripExtension(dataset)}${selectedCount > 0 ? `-selected-${selectedCount}` : '-preview'}.csv`,
              )
            }
            title={selectedCount > 0 ? `Export ${selectedCount} selected rows as CSV` : 'Export loaded rows as CSV'}
            className={cn('inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:border-white/[0.16] transition-colors', focusRing)}
          >
            <Download className="w-3.5 h-3.5" />
            Export{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>

          <button
            onClick={() => refetch()}
            title="Refresh preview"
            aria-label="Refresh preview"
            className={cn('inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:border-white/[0.16] transition-colors', focusRing)}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[64vh]">
        <table className="border-collapse text-[13px]" style={{ width: table.getTotalSize(), minWidth: '100%' }}>
          <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-white/[0.08] bg-surface">
                {hg.headers.map((header) => {
                  const pinned = header.column.getIsPinned();
                  const colId = header.column.id;
                  const meta = dtypeMeta(preview?.dtypes?.[colId], colId);
                  const sortDir = header.column.getIsSorted();
                  const numeric = colId !== '__index' && colId !== '__select' && meta.kind === 'numeric';
                  const hasSel = colId === selectedColumn;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : undefined}
                      style={{ width: header.getSize() }}
                      className={cn(
                        'relative px-4 py-3 align-bottom border-r border-white/[0.04] select-none',
                        numeric ? 'text-right' : 'text-left',
                        pinned && 'sticky z-30 bg-surface border-r border-white/[0.10]',
                        pinned === 'left' && 'left-0',
                        hasSel && 'bg-white/[0.03]',
                      )}
                    >
                      {colId === '__select' || colId === '__index' ? (
                        colId === '__select'
                          ? typeof header.column.columnDef.header === 'function'
                            ? (header.column.columnDef.header as (ctx: { table: Table<RowRecord> }) => React.ReactNode)({ table })
                            : null
                          : <span className="text-xs font-medium text-zinc-500">#</span>
                      ) : (
                        <div className={cn('flex flex-col gap-1 min-w-0', numeric && 'items-end')}>
                          <div className={cn('flex items-center gap-1.5 min-w-0', numeric && 'flex-row-reverse')}>
                            <meta.Icon className="w-3 h-3 shrink-0" style={{ color: meta.hex }} />
                            <button
                              type="button"
                              onClick={() => onSelectColumn(colId)}
                              title="Inspect column"
                              className={cn(
                                'text-xs font-semibold uppercase tracking-wider truncate max-w-[160px]',
                                hasSel ? 'text-blue-300' : 'text-zinc-400 hover:text-zinc-100',
                                focusRing,
                              )}
                            >
                              {colId}
                            </button>
                            {colId !== '__index' && colId !== '__select' && header.column.getCanSort() && (
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                title="Sort column"
                                aria-label={`Sort ${colId}`}
                                className={cn('shrink-0 text-zinc-600 hover:text-zinc-300', sortDir && 'text-zinc-200', focusRing)}
                              >
                                {sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : sortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3" />}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onSelectColumn(colId)}
                              title="View column details"
                              aria-label={`View details for ${colId}`}
                              className={cn('shrink-0 text-zinc-600 hover:text-blue-300', focusRing)}
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
                        aria-hidden="true"
                        className={cn(
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-blue-400/40',
                          header.column.getIsResizing() && 'bg-blue-400',
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
              Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array.from({ length: table.getAllLeafColumns().length }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3.5 rounded bg-white/[0.06] animate-pulse" style={{ width: `${60 + ((i + j) % 6) * 7}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={table.getAllLeafColumns().length}>
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                    <p className="text-sm text-zinc-400">Unable to load preview</p>
                    <button
                      onClick={() => refetch()}
                      className={cn('text-[13px] text-blue-300 hover:text-blue-200 underline underline-offset-2', focusRing)}
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllLeafColumns().length}>
                  <div className="py-16 text-center">
                    <FileSpreadsheet className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">
                      {globalFilter || activeFilterCount > 0
                        ? 'No rows match your search or filters on this page.'
                        : 'This page has no rows to display.'}
                    </p>
                    {(globalFilter || activeFilterCount > 0) && (
                      <button
                        onClick={() => { setSearchInput(''); setColumnFilters([]); }}
                        className={cn('mt-3 text-[13px] text-blue-300 hover:text-blue-200 underline underline-offset-2', focusRing)}
                      >
                        Clear search & filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-white/[0.04] transition-colors',
                    row.getIsSelected() ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]',
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const pinned = cell.column.getIsPinned();
                    const cellMeta = dtypeMeta(preview?.dtypes?.[cell.column.id], cell.column.id);
                    const isColSelected = cell.column.id !== '__index' && cell.column.id !== '__select' && cell.column.id === selectedColumn;
                    return (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={cn(
                          'px-4 py-2.5 whitespace-nowrap max-w-[320px] overflow-hidden text-ellipsis border-r border-white/[0.03]',
                          cellMeta.kind === 'numeric' && 'text-right tabular-nums',
                          pinned && 'sticky z-10 bg-card border-r border-white/[0.10]',
                          pinned === 'left' && 'left-0',
                          isColSelected && 'bg-white/[0.03]',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-3.5">
        <p className="text-[13px] text-zinc-500">
          Showing <span className="font-medium text-zinc-300">{from.toLocaleString()}–{to.toLocaleString()}</span> of{' '}
          <span className="font-medium text-zinc-300">{(preview?.total ?? 0).toLocaleString()}</span> rows
        </p>
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
    <div className="flex gap-2 overflow-x-auto px-5 pt-3 pb-2.5 border-b border-white/[0.08] bg-white/[0.01]">
      {columns.map((col) => {
        const meta = dtypeMeta(dtypes?.[col], col);
        const colProfile = details.find((d) => d.name === col);
        const hist = analysis?.distributions?.columns?.find((h) => h.column === col);
        const active = selectedColumn === col;
        return (
          <button
            key={col}
            type="button"
            onClick={() => onSelectColumn(col)}
            title={`View details for ${col}`}
            className={cn(
              'w-40 shrink-0 rounded-lg border bg-white/[0.02] p-2 text-left transition-colors',
              active
                ? 'border-blue-400/40 bg-blue-400/[0.04]'
                : 'border-white/[0.06] hover:border-white/[0.16] hover:bg-white/[0.03]',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1 min-w-0">
                <meta.Icon className="w-3 h-3 shrink-0" style={{ color: meta.hex }} />
                <span className={cn('truncate font-mono text-[11px] font-medium', active ? 'text-blue-300' : 'text-zinc-300')}>
                  {col}
                </span>
              </span>
              <span className={cn(
                'shrink-0 inline-flex items-center rounded-full border px-1 py-px text-[8px] font-semibold uppercase tracking-wide',
                meta.kind === 'numeric'
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              )}>
                {meta.kind === 'numeric' ? 'num' : 'cat'}
              </span>
            </div>
            {colProfile?.unique_values != null && (
              <div className="mt-1 text-[9px] text-zinc-600">{fmt.num(colProfile.unique_values)} unique</div>
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
    return <div className="mt-0.5 h-5 flex items-center text-[9px] text-zinc-700">—</div>;
  }
  const max = Math.max(...values, 1);
  const step = Math.max(1, Math.round(values.length / 24));
  const downsampled = values.filter((_, i) => i % step === 0).slice(0, 24);
  return (
    <div className="mt-0.5 flex items-end gap-[2px] h-5" aria-hidden="true">
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
    <details className="relative">
      <summary className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:border-white/[0.16] cursor-pointer list-none">
        <Filter className="w-3.5 h-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 text-[9px] font-bold">{activeCount}</span>
        )}
      </summary>
      <div className="absolute right-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto rounded-lg border border-white/[0.10] bg-[#101014] shadow-lg z-40 p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Filter by column</span>
          {activeCount > 0 && (
            <button onClick={() => onChange([])} className="text-[10px] text-blue-300 hover:underline">
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
                  className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20"
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
    <details className="relative">
      <summary className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:border-white/[0.16] cursor-pointer list-none">
        <Columns3 className="w-3.5 h-3.5" />
        Columns
        <span className="text-zinc-600">{Object.values(table.getState().columnVisibility).filter((v) => v !== false).length} / {previewColumnCount}</span>
      </summary>
      <div className="absolute right-0 top-full mt-1.5 w-56 max-h-72 overflow-y-auto rounded-lg border border-white/[0.10] bg-[#101014] shadow-lg z-30 p-2">
        <div className="flex items-center justify-between px-1 pb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Toggle columns</span>
          <button onClick={() => table.setColumnVisibility({})} className="text-[10px] text-blue-300 hover:underline">
            Reset
          </button>
        </div>
        {table.getAllLeafColumns().map((col) => (
          <label key={col.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-white/[0.04] cursor-pointer">
            <input
              type="checkbox"
              checked={col.getIsVisible()}
              onChange={col.getToggleVisibilityHandler()}
              className="accent-blue-500"
            />
            <span className="text-xs text-zinc-300 truncate">{col.id === '__select' ? '# (select)' : col.id === '__index' ? '# (row index)' : col.id}</span>
          </label>
        ))}
      </div>
    </details>
  );
}