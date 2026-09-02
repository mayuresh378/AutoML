import { cn } from '../../../../lib/cn';

export function corrColor(v: number): string {
  const a = Math.min(1, Math.abs(v || 0));
  const alpha = 0.14 + a * 0.82;
  return v >= 0 ? `rgba(59,130,246,${alpha})` : `rgba(239,68,68,${alpha})`;
}

export function corrTextColor(v: number): string {
  return Math.abs(v) > 0.55 ? '#e2e8f0' : '#a1a1aa';
}

interface CorrelationHeatmapProps {
  columns: string[];
  matrix: Array<{ column: string; [col: string]: number | string }>;
  selectedPair?: { x: string; y: string } | null;
  onSelectPair?: (pair: { x: string; y: string; value: number } | null) => void;
}

export function CorrelationHeatmap({ columns, matrix, selectedPair, onSelectPair }: CorrelationHeatmapProps) {
  const n = columns.length;
  if (n === 0) {
    return <p className="text-sm text-zinc-500">Correlation matrix unavailable for this dataset.</p>;
  }

  const getVal = (x: string, y: string): number => {
    const row = matrix.find((m) => m.column === x);
    if (!row) return 0;
    const v = row[y];
    return typeof v === 'number' ? v : 0;
  };

  const showValues = n <= 12;

  return (
    <div>
      <div
        className="grid gap-px bg-white/[0.04] p-px rounded-lg overflow-hidden"
        style={{ gridTemplateColumns: `minmax(0, 90px) repeat(${n}, minmax(0, 1fr))` }}
      >
        <div className="bg-card flex items-end justify-end p-1.5 text-[10px] text-zinc-600">columns →</div>
        {columns.map((c) => (
          <div key={`h-${c}`} className="bg-card px-1.5 py-1.5 truncate text-center text-[10px] font-medium text-zinc-500" title={c}>
            {c.length > 10 ? c.slice(0, 9) + '…' : c}
          </div>
        ))}
        {columns.map((row) => {
          const y = row;
          return (
            <div key={`row-${y}`} className="contents">
              <div className="bg-card flex items-center justify-end px-1.5 py-1.5 text-[10px] font-medium text-zinc-500 truncate" title={y}>
                {y.length > 10 ? y.slice(0, 9) + '…' : y}
              </div>
              {columns.map((x) => {
                const v = getVal(x, y);
                const isPair =
                  (selectedPair?.x === x && selectedPair?.y === y) ||
                  (selectedPair?.x === y && selectedPair?.y === x);
                return (
                  <div
                    key={`${x}-${y}`}
                    onClick={() => onSelectPair?.(isPair ? null : { x, y, value: v })}
                    title={`${x} ↔ ${y}: ${v.toFixed(3)}`}
                    className={cn(
                      'aspect-square flex items-center justify-center transition-transform hover:scale-[1.06]',
                      onSelectPair && 'cursor-pointer',
                      isPair && 'ring-1 ring-zinc-200',
                    )}
                    style={{ backgroundColor: corrColor(v) }}
                  >
                    {showValues && (
                      <span className="text-[9px] font-mono leading-none" style={{ color: corrTextColor(v) }}>
                        {v.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(239,68,68,0.6)' }} /> −1</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(255,255,255,0.1)' }} /> 0</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(59,130,246,0.6)' }} /> +1</span>
      </div>
    </div>
  );
}
