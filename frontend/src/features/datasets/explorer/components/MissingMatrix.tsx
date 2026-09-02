import { cn } from '../../../../lib/cn';

interface MissingMatrixProps {
  columns: string[];
  rows: Record<string, any>[];
  maxRows?: number;
}

export function MissingMatrix({ columns, rows, maxRows = 30 }: MissingMatrixProps) {
  const sample = rows.slice(0, maxRows);
  if (sample.length === 0 || columns.length === 0) {
    return <p className="text-sm text-zinc-500">Load a preview to visualize missing values.</p>;
  }

  const isMissing = (r: Record<string, any>, c: string) => r[c] == null || r[c] === '';

  return (
    <div>
      <div className="flex gap-[3px]">
        {columns.map((col) => {
          const miss = sample.filter((r) => isMissing(r, col)).length;
          const pct = (miss / sample.length) * 100;
          const allMissing = miss === sample.length;
          return (
            <div key={col} className="flex-1 min-w-0">
              <div className="flex flex-col gap-[2px]">
                {sample.map((r, i) => {
                  const missing = isMissing(r, col);
                  return (
                    <div
                      key={i}
                      className={cn('h-[7px] w-full rounded-[1px]', missing ? 'bg-red-500/80' : allMissing ? 'bg-red-500/80' : 'bg-zinc-700/50')}
                      title={`${col} row ${i + 1}: ${missing ? 'missing' : 'present'}`}
                    />
                  );
                })}
              </div>
              <div
                className={cn('mt-1.5 text-[9px] font-medium truncate text-center', pct > 0 ? 'text-red-400' : 'text-zinc-600')}
                title={`${col} — ${pct.toFixed(0)}% missing`}
              >
                {col}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px] bg-red-500/80" /> Missing</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px] bg-zinc-700/50" /> Present</span>
        <span className="text-zinc-600">Showing {sample.length} sample rows</span>
      </div>
    </div>
  );
}
