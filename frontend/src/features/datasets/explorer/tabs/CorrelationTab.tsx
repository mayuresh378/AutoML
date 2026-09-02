import { useMemo, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';
import { ArrowUpDown, Grid3X3, Sparkles } from 'lucide-react';
import type { DatasetAnalysisResult, DatasetPreview } from '../types';
import { CorrelationHeatmap } from '../components/CorrelationHeatmap';
import { fmt } from '../utils';
import { cn } from '../../../../lib/cn';

interface CorrelationTabProps {
  analysis?: DatasetAnalysisResult;
  preview?: DatasetPreview;
  onSelectColumn: (col: string) => void;
}

export function CorrelationTab({ analysis, preview, onSelectColumn }: CorrelationTabProps) {
  const [selectedPair, setSelectedPair] = useState<{ x: string; y: string; value: number } | null>(null);

  const correlation = analysis?.correlation;
  const topPairs = correlation?.top_correlations || [];
  const columns = correlation?.columns || [];

  const scatterData = useMemo(() => {
    if (!selectedPair || !preview?.rows?.length) return [];
    return preview.rows
      .map((r) => ({ x: r[selectedPair.x], y: r[selectedPair.y] }))
      .filter((p) => p.x != null && p.y != null && p.x !== '' && p.y !== '')
      .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
      .filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y));
  }, [selectedPair, preview]);

  const activePair = selectedPair || (topPairs.length ? { x: topPairs[0].x, y: topPairs[0].y, value: topPairs[0].value } : null);

  if (!correlation || (columns.length < 2)) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <ArrowUpDown className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">{correlation?.message || 'Correlation analysis needs at least 2 numeric columns.'}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5 items-start">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Grid3X3 className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Correlation Heatmap</h3>
          <span className="text-xs text-zinc-500 ml-auto">{columns.length} × {columns.length} matrix</span>
        </div>
        <CorrelationHeatmap
          columns={columns}
          matrix={correlation.matrix || []}
          selectedPair={selectedPair ? { x: selectedPair.x, y: selectedPair.y } : null}
          onSelectPair={(p) => setSelectedPair(p)}
        />
      </div>

      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-zinc-100">Strongest Correlations</h3>
          </div>
          {topPairs.length === 0 ? (
            <p className="text-sm text-zinc-500">No strong pairwise correlations detected.</p>
          ) : (
            <div className="space-y-2">
              {topPairs.slice(0, 8).map((p, i) => {
                const strength = Math.abs(p.value);
                const label = strength >= 0.8 ? 'very strong' : strength >= 0.6 ? 'strong' : strength >= 0.4 ? 'moderate' : strength >= 0.2 ? 'weak' : 'none';
                return (
                  <button
                    key={`${p.x}-${p.y}`}
                    onClick={() => setSelectedPair(p)}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-lg border border-white/[0.05] px-3 py-2 transition-colors hover:border-primary/40',
                      activePair?.x === p.x && activePair?.y === p.y && 'border-primary/40 bg-primary/[0.04]',
                    )}
                  >
                    <span className="text-[10px] text-zinc-600 w-5">{i + 1}</span>
                    <span className="flex-1 text-xs font-mono text-zinc-300 truncate text-left">
                      {p.x} <span className="text-zinc-600">↔</span> {p.y}
                    </span>
                    <span className="w-12 text-right font-mono text-xs" style={{ color: p.value >= 0 ? '#38bdf8' : '#f87171' }}>
                      {p.value.toFixed(2)}
                    </span>
                    <span className="w-16 text-right text-[10px] text-zinc-500">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-zinc-100">Scatter</h3>
            {activePair && (
              <button onClick={() => onSelectColumn(activePair.x)} className="text-xs text-primary hover:underline font-mono">
                {activePair.x}
              </button>
            )}
            <span className="text-zinc-600 text-xs">vs</span>
            {activePair && (
              <button onClick={() => onSelectColumn(activePair.y)} className="text-xs text-primary hover:underline font-mono">
                {activePair.y}
              </button>
            )}
          </div>
          <p className="text-[10px] text-zinc-600 mb-2">{activePair ? `${scatterData.length} points from loaded preview` : 'Select a pair above'}</p>
          <div className="h-56">
            {activePair && scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 6, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <XAxis dataKey="x" name={activePair.x} tick={{ fill: '#71717a', fontSize: 9 }} stroke="#27272a" tickLine={false} />
                  <YAxis dataKey="y" name={activePair.y} tick={{ fill: '#71717a', fontSize: 9 }} stroke="#27272a" tickLine={false} />
                  <ZAxis range={[30, 40]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3', stroke: '#52525b' }}
                    contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }}
                    formatter={(value: any) => [fmt.dec(Number(value), 2), undefined]}
                  />
                  <Scatter data={scatterData} fill="#8b5cf6" fillOpacity={0.65} />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-zinc-600">
                {activePair ? 'No numeric points in the loaded preview for this pair.' : 'Select a correlated pair to view its scatter plot.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
