import { useState, useMemo, memo, useCallback } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel,
  flexRender, createColumnHelper, SortingState, ColumnFiltersState,
} from '@tanstack/react-table';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Copy, Check, Search, Table2, Clock, Filter, X,
} from 'lucide-react';
import { sqlService } from '../services/sqlEditor.service';
import { QueryResult } from '../types';
import styles from './ResultsGrid.module.css';

interface ResultsGridProps {
  result: QueryResult;
}

export const ResultsGrid = memo(function ResultsGrid({ result }: ResultsGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [rowSize, setRowSize] = useState<'compact' | 'comfortable'>('compact');
  const [showColFilters, setShowColFilters] = useState(false);

  const columns = useMemo(() => {
    return result.columns.map((col) => ({
      accessorKey: col,
      header: col,
      cell: (info: any) => {
        const val = info.getValue();
        return val != null ? String(val) : null;
      },
      size: 150,
    }));
  }, [result.columns]);

  const data = useMemo(() => result.data, [result.data]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const copyCell = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCell(value);
      setTimeout(() => setCopiedCell(null), 1500);
    } catch {}
  }, []);

  const copyRow = useCallback(async (row: Record<string, any>) => {
    const text = Object.values(row).join('\t');
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }, []);

  const copyTable = useCallback(async () => {
    const header = result.columns.join('\t');
    const rows = result.data.map((r) => result.columns.map((c) => r[c] ?? '').join('\t')).join('\n');
    try { await navigator.clipboard.writeText(`${header}\n${rows}`); } catch {}
  }, [result]);

  const handleExportCSV = useCallback(() => {
    sqlService.exportCSV(result.data, `query_export_${Date.now()}`);
  }, [result.data]);

  const handleExportJSON = useCallback(() => {
    sqlService.exportJSON(result.data, `query_export_${Date.now()}`);
  }, [result.data]);

  const handleExportExcel = useCallback(() => {
    sqlService.exportExcel(result.data, `query_export_${Date.now()}`);
  }, [result.data]);

  const activeColFilters = columnFilters.length;

  return (
    <div className={styles.grid}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.rowCount}>
            <Table2 className={styles.rowCountIcon} />
            <span>{result.rows} row{result.rows !== 1 ? 's' : ''}</span>
          </div>
          {result.executionTime && (
            <div className={styles.execTime}>
              <Clock className={styles.execTimeIcon} />
              {result.executionTime}ms
            </div>
          )}
        </div>

        <div className={styles.headerRight}>
          <button
            onClick={() => setShowColFilters(!showColFilters)}
            className={`${styles.gridBtn} ${showColFilters || activeColFilters ? styles.gridBtnActive : ''}`}
            title="Column filters"
          >
            <Filter className={styles.gridBtnIcon} />
            {activeColFilters > 0 && <span>{activeColFilters}</span>}
          </button>

          <div className={styles.filterWrapper}>
            <Search className={styles.filterIcon} />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Filter..."
              className={styles.filterInput}
            />
          </div>

          <div className={styles.gridActions}>
            <button onClick={() => setRowSize(rowSize === 'compact' ? 'comfortable' : 'compact')} className={styles.gridBtn}>
              {rowSize === 'compact' ? 'Cmf' : 'Cpt'}
            </button>
            <button onClick={copyTable} className={styles.gridBtn} title="Copy table">
              <Copy className={styles.gridBtnIcon} />
            </button>
            <button onClick={handleExportCSV} className={styles.gridBtn} title="Export CSV">
              <Download className={styles.gridBtnIcon} /> CSV
            </button>
            <button onClick={handleExportJSON} className={styles.gridBtn} title="Export JSON">
              <Download className={styles.gridBtnIcon} /> JSON
            </button>
            <button onClick={handleExportExcel} className={styles.gridBtn} title="Export Excel">
              <Download className={styles.gridBtnIcon} /> XLS
            </button>
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                <th className={`${styles.th} ${styles.thRowNum}`}>
                  #
                </th>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={styles.th}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ width: header.getSize() }}
                  >
                    <div className={styles.thContent}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' ? <ArrowUp className={styles.sortIcon} /> :
                       header.column.getIsSorted() === 'desc' ? <ArrowDown className={styles.sortIcon} /> :
                       <ArrowUpDown className={`${styles.sortIcon} ${styles.sortInactive}`} />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
            {showColFilters && (
              <tr>
                <th className={`${styles.th} ${styles.thRowNum}`}>
                  <button
                    onClick={() => setColumnFilters([])}
                    className={styles.clearFiltersBtn}
                    title="Clear all column filters"
                  >
                    <X className={styles.gridBtnIcon} />
                  </button>
                </th>
                {table.getAllLeafColumns().map((col) => (
                  <th key={col.id} className={styles.th}>
                    <input
                      value={(col.getFilterValue() as string) ?? ''}
                      onChange={(e) => col.setFilterValue(e.target.value || undefined)}
                      placeholder={`Filter ${col.id}...`}
                      className={styles.colFilterInput}
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={idx % 2 === 0 ? styles.rowEven : styles.rowOdd}
              >
                <td className={`${styles.td} ${styles.tdRowNum}`}>
                  {row.index + 1 + table.getState().pagination.pageIndex * table.getState().pagination.pageSize}
                </td>
                {row.getVisibleCells().map((cell) => {
                  const val = cell.getValue();
                  return (
                    <td
                      key={cell.id}
                      className={styles.td}
                      onClick={() => val != null && copyCell(String(val))}
                      title={val != null ? String(val) : 'NULL'}
                    >
                      <span className={`${styles.cellValue} ${val == null ? styles.cellNull : ''} ${typeof val === 'number' ? styles.cellNumber : ''}`}>
                        {val != null ? String(val) : 'NULL'}
                      </span>
                      {copiedCell === String(val) && (
                        <span className={styles.cellCopied}>
                          <Check className={styles.sortIcon} />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerInfo}>
          {table.getFilteredRowModel().rows.length} of {result.data.length} rows
        </div>
        <div className={styles.footerControls}>
          <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className={styles.gridBtn}>
            <ChevronsLeft className={styles.gridBtnIcon} />
          </button>
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className={styles.gridBtn}>
            <ChevronLeft className={styles.gridBtnIcon} />
          </button>
          <span className={styles.pageInfo}>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className={styles.gridBtn}>
            <ChevronRight className={styles.gridBtnIcon} />
          </button>
          <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className={styles.gridBtn}>
            <ChevronsRight className={styles.gridBtnIcon} />
          </button>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className={styles.pageSizeSelect}
          >
            {[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
});
