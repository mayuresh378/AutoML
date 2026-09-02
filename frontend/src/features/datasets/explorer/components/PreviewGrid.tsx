import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnSizingState,
  type ColumnPinningState,
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
} from 'lucide-react';
import { useExplorerPreview } from '../hooks';
import { getErrorMessage } from '../../../../services/http';
import { dtypeMeta, exportRowsToCsv, copyRowsToClipboard, fmt, stripExtension } from '../utils';
import { Pagination } from '../../../../components/ui/Pagination';
import { cn } from '../../../../lib/cn';

interface PreviewGridProps {
  dataset: string;
  onSelectColumn: (col: string) => void;
  selectedColumn?: string | null;
}

type RowRecord = Record<string, any>;

export function PreviewGrid({ dataset, onSelectColumn, selectedColumn }: PreviewGridProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: ['__index'] });
  const [copied, setCopied] = useState(false);

  const { data: preview, isLoading, isError, error, refetch } = useExplorerPreview(
    dataset,
    pageSize,
    pageIndex * pageSize,
  );

  const columns = useMemo<ColumnDef<RowRecord, any>[]>(() => {
    const cols = preview?.columns ?? [];
    const defs: ColumnDef<RowRecord, any>[] = [
      {
        id: '__index',
        header: '#',
        size: 56,
        enableResizing: false,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-zinc-600 font-mono text-xs">{pageIndex * pageSize + row.index + 1}</span>
        ),
      },
      ...cols.map((col): ColumnDef<RowRecord, any> => {
        const meta = dtypeMeta(preview?.dtypes?.[col], col);
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
              <span className={cn('font-mono text-[13px]', meta.kind === 'numeric' ? 'text-zinc-200' : 'text-zinc-300')}>
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
    state: { sorting, globalFilter, columnVisibility, columnSizing, columnPinning },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
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

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-white/[0.02]">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search loaded rows…"
            className="w-full rounded-lg bg-white/[0.04] border border-border pl-8 pr-8 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
          />
          {globalFilter && (
            <button onClick={() => setGlobalFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <details className="relative group">
            <summary className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-primary/40 hover:text-zinc-100 cursor-pointer list-none">
              <Columns3 className="w-3.5 h-3.5" />
              Columns
              <span className="text-zinc-500">{Object.keys(columnVisibility).filter((k) => columnVisibility[k] !== false).length || (preview?.columns?.length ?? 0)}</span>
            </summary>
            <div className="absolute right-0 top-full mt-1.5 w-56 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface shadow-dropdown z-30 p-2">
              <div className="flex items-center justify-between px-1 pb-1.5">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Toggle columns</span>
                <button
                  onClick={() => setColumnVisibility({})}
                  className="text-[10px] text-primary hover:underline"
                >
                  Reset
                </button>
              </div>
              {table.getAllLeafColumns().map((col) => (
                <label key={col.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-white/[0.04] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                    className="accent-primary"
                  />
                  <span className="text-xs text-zinc-300 truncate">{col.id === '__index' ? '# (row index)' : col.id}</span>
                </label>
              ))}
            </div>
          </details>

          <button onClick={handleCopy} title="Copy loaded rows" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-primary/40 hover:text-zinc-100">
            {copied ? <span className="text-emerald-400">Copied</span> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>

          <button
            onClick={() => exportRowsToCsv(rows.map((r) => r.original), `${stripExtension(dataset)}-preview.csv`)}
            title="Export loaded rows as CSV"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-primary/40 hover:text-zinc-100"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          <button onClick={() => refetch()} title="Refresh" className="inline-flex items-center rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-primary/40 hover:text-zinc-100">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-auto max-h-[62vh]">
        <table className="border-collapse" style={{ width: table.getTotalSize(), minWidth: '100%' }}>
          <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-surface">
                {hg.headers.map((header) => {
                  const pinned = header.column.getIsPinned();
                  const colId = header.column.id;
                  const meta = dtypeMeta(
                    preview?.dtypes?.[colId],
                    colId,
                  );
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className={cn(
                        'px-3 py-2.5 text-left align-bottom border-r border-white/[0.04] select-none',
                        pinned === 'left' && 'sticky left-0 z-30 bg-surface border-r border-border',
                        colId !== '__index' && colId === selectedColumn && 'bg-primary/[0.07]',
                      )}
                    >
                      {colId === '__index' ? (
                        <span className="text-xs font-semibold text-zinc-500">#</span>
                      ) : (
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="flex items-center gap-1 min-w-0">
                              <meta.Icon className="w-3 h-3 shrink-0" style={{ color: meta.hex }} />
                              <button
                                onClick={() => onSelectColumn(colId)}
                                title="Inspect column"
                                className={cn(
                                  'text-xs font-semibold uppercase tracking-wider truncate max-w-[150px]',
                                  colId === selectedColumn ? 'text-primary' : 'text-zinc-300 hover:text-zinc-100',
                                )}
                              >
                                {colId}
                              </button>
                            </span>
                            {header.column.getCanSort() && (
                              <button
                                onClick={header.column.getToggleSortingHandler()}
                                className={cn('shrink-0 text-zinc-600 hover:text-zinc-300', sortDir && 'text-primary')}
                                title="Sort"
                              >
                                {sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : sortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3" />}
                              </button>
                            )}
                            <button
                              onClick={() => onSelectColumn(colId)}
                              className="shrink-0 text-zinc-600 hover:text-primary"
                              title="View column details"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                          <span className={cn('inline-flex w-fit items-center rounded-full border px-1.5 py-px text-[9px] font-medium', meta.cls)}>
                            {meta.label}
                          </span>
                        </div>
                      )}
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/60',
                          header.column.getIsResizing() && 'bg-primary',
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
                    <button onClick={() => refetch()} className="text-xs text-primary hover:underline">Try again</button>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllColumns().length}>
                  <div className="py-14 text-center text-sm text-zinc-500">
                    {globalFilter ? 'No rows match your search on this page.' : 'No rows in this page.'}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  {row.getVisibleCells().map((cell) => {
                    const pinned = cell.column.getIsPinned();
                    return (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={cn(
                          'px-3 py-2 whitespace-nowrap max-w-[320px] overflow-hidden text-ellipsis border-r border-white/[0.03]',
                          pinned === 'left' && 'sticky left-0 z-10 bg-card border-r border-border',
                          cell.column.id === selectedColumn && 'bg-primary/[0.04]',
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

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-white/[0.02]">
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
              className="rounded bg-card border border-border px-1.5 py-0.5 text-xs text-zinc-300 focus:outline-none"
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
