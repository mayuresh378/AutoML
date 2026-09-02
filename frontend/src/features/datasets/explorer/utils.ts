import {
  Hash,
  CheckCircle,
  CalendarDays,
  Type,
  Fingerprint,
  FileText,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

export const fmt = {
  num(n: number | null | undefined): string {
    if (n == null || Number.isNaN(n)) return '—';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  },
  int(n: number | null | undefined): string {
    if (n == null || Number.isNaN(n)) return '—';
    return n.toLocaleString('en-US');
  },
  dec(n: number | null | undefined, digits = 2): string {
    if (n == null || Number.isNaN(n)) return '—';
    return n.toLocaleString('en-US', { maximumFractionDigits: digits });
  },
  pct(n: number | null | undefined, digits = 1): string {
    if (n == null || Number.isNaN(n)) return '—';
    return n.toFixed(digits) + '%';
  },
  bytes(kb: number | null | undefined): string {
    if (kb == null || Number.isNaN(kb)) return '—';
    if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
    return kb.toFixed(1) + ' KB';
  },
  date(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  dateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },
  timeAgo(iso: string | null | undefined): string {
    if (!iso) return '—';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '—';
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 30) return `${days}d ago`;
    const mo = Math.floor(days / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(mo / 12)}y ago`;
  },
};

export type DtypeKind =
  | 'numeric'
  | 'boolean'
  | 'datetime'
  | 'categorical'
  | 'text'
  | 'id'
  | 'unknown';

export interface DtypeMeta {
  label: string;
  kind: DtypeKind;
  cls: string;
  hex: string;
  Icon: LucideIcon;
}

export function dtypeMeta(dtype: string | undefined, col?: string): DtypeMeta {
  const d = (dtype || '').toLowerCase();
  const lowerCol = (col || '').toLowerCase();
  if (d.includes('int') || d.includes('float') || d.includes('number') || d.includes('long')) {
    return { label: dtype || 'numeric', kind: 'numeric', cls: 'bg-sky-500/10 text-sky-400 border border-sky-500/20', hex: '#38bdf8', Icon: Hash };
  }
  if (d.includes('bool')) {
    return { label: dtype || 'boolean', kind: 'boolean', cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', hex: '#34d399', Icon: CheckCircle };
  }
  if (d.includes('datetime') || d.includes('timestamp') || d.includes('time')) {
    return { label: dtype || 'datetime', kind: 'datetime', cls: 'bg-violet-500/10 text-violet-400 border border-violet-500/20', hex: '#a78bfa', Icon: CalendarDays };
  }
  if (/(^id$|_id$|\.id$|^index$|id$)/.test(lowerCol)) {
    return { label: 'identifier', kind: 'id', cls: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20', hex: '#71717a', Icon: Fingerprint };
  }
  if (d.includes('object') || d.includes('str') || d.includes('category') || d === 'object') {
    return { label: dtype || 'categorical', kind: 'categorical', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', hex: '#fbbf24', Icon: Type };
  }
  return { label: dtype || 'unknown', kind: 'unknown', cls: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20', hex: '#71717a', Icon: HelpCircle };
}

export function featureTypeMeta(kind: string): { label: string; cls: string; hex: string; Icon: LucideIcon } {
  const map: Record<string, { label: string; cls: string; hex: string; Icon: LucideIcon }> = {
    numeric: { label: 'Numeric', cls: 'bg-sky-500/10 text-sky-400 border border-sky-500/20', hex: '#38bdf8', Icon: Hash },
    categorical: { label: 'Categorical', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', hex: '#fbbf24', Icon: Type },
    text: { label: 'Text', cls: 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20', hex: '#e879f9', Icon: FileText },
    datetime: { label: 'Datetime', cls: 'bg-violet-500/10 text-violet-400 border border-violet-500/20', hex: '#a78bfa', Icon: CalendarDays },
    boolean: { label: 'Boolean', cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', hex: '#34d399', Icon: CheckCircle },
    id: { label: 'Identifier', cls: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20', hex: '#71717a', Icon: Fingerprint },
  };
  return map[kind] || map.categorical;
}

export function severityTone(sev: string): 'success' | 'warning' | 'error' {
  if (sev === 'high') return 'error';
  if (sev === 'medium') return 'warning';
  return 'success';
}

export function severityHex(sev: string): string {
  if (sev === 'high') return '#ef4444';
  if (sev === 'medium') return '#f59e0b';
  return '#22c55e';
}

export function severityLabel(sev: string): string {
  return sev ? sev.charAt(0).toUpperCase() + sev.slice(1) : '—';
}

export function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#34d399';
    case 'B': return '#22c55e';
    case 'C': return '#fbbf24';
    case 'D': return '#fb923c';
    default: return '#f87171';
  }
}

export function gradeTextCls(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-400';
    case 'B': return 'text-green-400';
    case 'C': return 'text-amber-400';
    case 'D': return 'text-orange-400';
    default: return 'text-red-400';
  }
}

export function stripExtension(name: string): string {
  return name.replace(/\.\w+$/, '');
}

export function baseDatasetName(name: string): string {
  let n = stripExtension(name);
  n = n.replace(/^(cleaned|featurized)_/i, '');
  n = n.replace(/_(cleaned|featurized)$/i, '');
  return n;
}

export function exportRowsToCsv(rows: Record<string, any>[], filename: string) {
  const header = Object.keys(rows[0] || {});
  const lines = [
    header.join(','),
    ...rows.map((r) => header.map((k) => JSON.stringify(r[k] ?? '')).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyRowsToClipboard(rows: Record<string, any>[]): Promise<void> {
  const header = Object.keys(rows[0] || {});
  const tsv = [
    header.join('\t'),
    ...rows.map((r) => header.map((k) => (r[k] == null || r[k] === '' ? '' : String(r[k]))).join('\t')),
  ].join('\n');
  await navigator.clipboard.writeText(tsv);
}
