import { useState, useMemo, ReactNode } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { TableVirtuoso } from 'react-virtuoso';

export interface ColumnDef {
  key: string;
  header: string;
  width?: number;
  render?: (value: any, row: any) => ReactNode;
}

interface VirtualizedTableProps {
  columns: ColumnDef[];
  data: Record<string, any>[];
  rowHeight?: number;
  overscan?: number;
  maxHeight?: number;
  className?: string;
  emptyMessage?: string;
}

export function VirtualizedTable({
  columns,
  data,
  rowHeight = 40,
  overscan = 5,
  maxHeight = 400,
  className,
  emptyMessage,
}: VirtualizedTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDir === 'asc' ? -1 : 1;
      if (bVal == null) return sortDir === 'asc' ? 1 : -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-500">{emptyMessage || 'No data available'}</p>;
  }

  return (
    <div className={className}>
      <TableVirtuoso
        style={{ maxHeight }}
        data={sortedData}
        overscan={overscan}
        fixedHeaderContent={() => (
          <tr className="bg-[#111827]">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="px-3 py-2 text-left text-xs font-medium text-slate-400 whitespace-nowrap cursor-pointer hover:text-white transition-colors select-none"
                style={col.width ? { width: col.width } : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {sortKey === col.key && (
                    sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        )}
        itemContent={(index: number, row: Record<string, any>) => (
          <>
            {columns.map((col) => (
              <td key={col.key} className="px-3 py-2 text-sm text-zinc-300 whitespace-nowrap">
                {col.render ? col.render(row[col.key], row) : (row[col.key] != null ? String(row[col.key]) : '')}
              </td>
            ))}
          </>
        )}
        components={{
          Table: (props: any) => (
            <table {...props} className="w-full text-sm" style={{ ...props.style, tableLayout: 'fixed' }} />
          ),
          TableRow: (props: any) => (
            <tr {...props} className="border-b border-white/5 hover:bg-white/[0.02]" style={{ ...props.style, height: rowHeight }} />
          ),
        }}
      />
    </div>
  );
}
