import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

interface NodeDef {
  id: string;
  x: number;
  y: number;
  r: number;
  layer: 0 | 1 | 2;
}

const NODES: NodeDef[] = [
  { id: 'i1', x: 40, y: 60, r: 5, layer: 0 },
  { id: 'i2', x: 40, y: 130, r: 5, layer: 0 },
  { id: 'i3', x: 40, y: 200, r: 5, layer: 0 },
  { id: 'i4', x: 40, y: 270, r: 5, layer: 0 },
  { id: 'h1', x: 190, y: 40, r: 6, layer: 1 },
  { id: 'h2', x: 190, y: 110, r: 6, layer: 1 },
  { id: 'h3', x: 190, y: 180, r: 6, layer: 1 },
  { id: 'h4', x: 190, y: 250, r: 6, layer: 1 },
  { id: 'h5', x: 190, y: 300, r: 6, layer: 1 },
  { id: 'o1', x: 340, y: 110, r: 7, layer: 2 },
  { id: 'o2', x: 340, y: 200, r: 7, layer: 2 },
];

const EDGES: Array<[string, string]> = [
  ['i1', 'h1'], ['i1', 'h2'], ['i1', 'h3'],
  ['i2', 'h1'], ['i2', 'h3'], ['i2', 'h4'],
  ['i3', 'h2'], ['i3', 'h4'], ['i3', 'h5'],
  ['i4', 'h3'], ['i4', 'h5'],
  ['h1', 'o1'], ['h2', 'o1'], ['h3', 'o1'], ['h3', 'o2'],
  ['h4', 'o2'], ['h5', 'o2'],
];

const nodeMap = Object.fromEntries(NODES.map((n) => [n.id, n]));

const layerColor: Record<number, string> = {
  0: '#06B6D4',
  1: '#6366F1',
  2: '#7C3AED',
};

export function NeuralPulse() {
  const [requestCount, setRequestCount] = useState(18420);
  const [activeEdge, setActiveEdge] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setRequestCount((c) => c + Math.floor(Math.random() * 5) + 1);
    }, 1400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setActiveEdge((e) => (e + 1) % EDGES.length);
    }, 220);
    return () => clearInterval(t);
  }, []);

  const pulses = useMemo(() => {
    // Show a handful of concurrent traveling pulses, offset from the active edge cursor.
    return [0, 5, 11, 16].map((offset) => EDGES[(activeEdge + offset) % EDGES.length]);
  }, [activeEdge]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <svg
        viewBox="0 0 380 340"
        className="w-full max-w-[420px] h-auto"
        role="img"
        aria-label="Live animated diagram of an active neural network processing requests"
      >
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818CF8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {EDGES.map(([a, b], i) => {
          const na = nodeMap[a];
          const nb = nodeMap[b];
          return (
            <line
              key={i}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          );
        })}

        {pulses.map(([a, b], i) => {
          const na = nodeMap[a];
          const nb = nodeMap[b];
          return (
            <motion.circle
              key={`${a}-${b}-${i}`}
              r={2.4}
              fill={layerColor[na.layer]}
              initial={{ cx: na.x, cy: na.y, opacity: 0 }}
              animate={{ cx: [na.x, nb.x], cy: [na.y, nb.y], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.1, ease: 'easeInOut' }}
            />
          );
        })}

        {NODES.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.r + 8} fill="url(#nodeGlow)" opacity={0.5} />
            <motion.circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={layerColor[n.layer]}
              animate={{ r: [n.r, n.r + 1.2, n.r] }}
              transition={{ duration: 2.4 + (n.x % 5) * 0.1, repeat: Infinity, ease: 'easeInOut' }}
            />
          </g>
        ))}
      </svg>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-border-strong bg-card/80 backdrop-blur px-4 py-2 shadow-glow-sm">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-pulseRing" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        <span className="font-mono text-xs text-zinc-300 tabular-nums">
          {requestCount.toLocaleString()} inferences today
        </span>
      </div>
    </div>
  );
}
