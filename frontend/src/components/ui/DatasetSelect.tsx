import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check, ChevronDown, Clock, Database, FileText, Search, Star, X,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import type { Dataset } from '../../types/api';

const RECENTS_KEY = 'dataset-select:recents';
const FAVORITES_KEY = 'dataset-select:favorites';

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v: unknown): v is string => typeof v === 'string') : [];
  } catch { return []; }
}

function writeList(key: string, list: string[]) {
  try { localStorage.setItem(key, JSON.stringify(list.slice(0, 6))); } catch { /* */ }
}

const fmtInt = (n?: number | null) => (n == null || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString());

function formatBytes(kb?: number) {
  if (kb == null || Number.isNaN(kb)) return '—';
  if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
  return Math.max(kb, 0.1).toFixed(0) + ' KB';
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const statusTone: Record<string, string> = {
  ready: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  uploaded: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  processing: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  training: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  queued: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  error: 'text-red-400 bg-red-500/10 border-red-500/25',
  failed: 'text-red-400 bg-red-500/10 border-red-500/25',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
};

interface Position { top: number; left: number; width: number; openUp: boolean }

interface DatasetSelectProps {
  datasets: Dataset[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export function DatasetSelect({ datasets, value, onChange, placeholder = 'Select a dataset', className, disabled, loading }: DatasetSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const [position, setPosition] = useState<Position | null>(null);
  const [recents, setRecents] = useState<string[]>(() => readList(RECENTS_KEY));
  const [favorites, setFavorites] = useState<string[]>(() => readList(FAVORITES_KEY));

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const selected = useMemo(() => datasets.find((d) => d.name === value) ?? null, [datasets, value]);

  const q = query.trim().toLowerCase();

  const matches = useCallback((d: Dataset) => {
    if (!q) return true;
    const hay = (d.name + ' ' + (d.filename || '')).toLowerCase();
    return hay.includes(q);
  }, [q]);

  const visible = useMemo(() => {
    const favSet = new Set(favorites);
    const recSet = new Set(recents);

    if (q) {
      const flat = datasets.filter(matches);
      return { sections: [] as { label: string; icon: typeof Database; items: Dataset[] }[], flat };
    }

    const favItems = favorites
      .map((f) => datasets.find((d) => d.name === f))
      .filter(Boolean) as Dataset[];

    const recItems = recents
      .map((r) => datasets.find((d) => d.name === r))
      .filter((d): d is Dataset => !!d && !favSet.has(d.name));

    const rest = datasets.filter((d) => !favSet.has(d.name) && !recSet.has(d.name));

    const sections: { label: string; icon: typeof Database; items: Dataset[] }[] = [];
    if (favItems.length) sections.push({ label: 'Favorites', icon: Star, items: favItems });
    if (recItems.length) sections.push({ label: 'Recent', icon: Clock, items: recItems });
    sections.push({ label: 'All Datasets', icon: Database, items: rest });

    const flat = sections.flatMap((s) => s.items);
    return { sections, flat };
  }, [datasets, q, favorites, recents, matches]);

  const selectValue = useCallback((name: string) => {
    onChange(name);
    setRecents((prev) => {
      const next = [name, ...prev.filter((r) => r !== name)].slice(0, 6);
      writeList(RECENTS_KEY, next);
      return next;
    });
    setOpen(false);
  }, [onChange]);

  const toggleFavorite = useCallback((e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    e.preventDefault();
    setFavorites((prev) => {
      const next = prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name];
      writeList(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const moveHighlight = useCallback((dir: 1 | -1) => {
    setHighlight((h) => {
      const n = visible.flat.length;
      if (n === 0) return -1;
      const next = h + dir;
      if (next < 0) return n - 1;
      if (next >= n) return 0;
      return next;
    });
  }, [visible.flat.length]);

  const handleSelectHighlighted = useCallback(() => {
    if (highlight < 0) {
      if (visible.flat.length === 1) selectValue(visible.flat[0].name);
      return;
    }
    const d = visible.flat[highlight];
    if (d) selectValue(d.name);
  }, [highlight, visible.flat, selectValue]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveHighlight(1); break;
      case 'ArrowUp': e.preventDefault(); moveHighlight(-1); break;
      case 'Home': e.preventDefault(); setHighlight(0); break;
      case 'End': e.preventDefault(); setHighlight(visible.flat.length - 1); break;
      case 'Enter': e.preventDefault(); handleSelectHighlighted(); break;
      case 'Escape': e.preventDefault(); setOpen(false); break;
      case 'Tab': setOpen(false); break;
    }
  }, [moveHighlight, handleSelectHighlighted, visible.flat.length]);

  useEffect(() => {
    setHighlight(q ? 0 : -1);
  }, [q]);

  useEffect(() => {
    if (open) {
      setQuery('');
      const idx = datasets.findIndex((d) => d.name === value);
      setHighlight(idx >= 0 ? idx : 0);
      requestAnimationFrame(() => {
        if (value) itemRefs.current[value]?.scrollIntoView({ block: 'nearest' });
        searchRef.current?.focus();
      });
    } else {
      setQuery('');
      setHighlight(-1);
    }
  }, [open, datasets, value]);

  useEffect(() => {
    if (highlight >= 0) {
      const name = visible.flat[highlight]?.name;
      if (name) itemRefs.current[name]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlight, visible.flat]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const popH = 430;
      const spaceBelow = vw < 480 ? 0 : window.innerHeight - r.bottom - 12;
      const spaceAbove = vw < 480 ? 0 : r.top - 12;
      const openUp = spaceBelow < popH && spaceAbove > spaceBelow;
      const width = Math.min(Math.max(r.width, 320), vw - 16);
      const left = vw < 480 ? 8 : Math.min(Math.max(r.left, 8), vw - width - 8);
      const top = openUp
        ? Math.max(8, r.top - 12 - Math.min(popH, spaceAbove))
        : r.bottom + 8;
      setPosition({ top, left, width, openUp });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent | MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const renderItem = (d: Dataset) => {
    const idx = visible.flat.findIndex((x) => x.name === d.name);
    const active = highlight === idx;
    const isSelected = value === d.name;
    const isFav = favorites.includes(d.name);
    const updated = d.updated_at || d.created_at;

    const itemClasses = cn(
      'group flex items-center gap-3 cursor-pointer transition-all duration-[150ms]',
      active && !isSelected && 'bg-[#1E293B] text-white',
      active && isSelected && 'text-[#60A5FA]',
      !active && isSelected && 'bg-[rgba(59,130,246,0.15)] text-[#60A5FA] font-semibold',
      !active && !isSelected && 'text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white hover:translate-x-0.5',
    );

    return (
      <div
        key={d.name}
        ref={(el) => { itemRefs.current[d.name] = el; }}
        role="option"
        id={`ds-opt-${d.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
        aria-selected={isSelected}
        data-index={idx}
        onMouseEnter={() => setHighlight(idx)}
        onClick={() => selectValue(d.name)}
        className={itemClasses}
        style={{ height: 40, padding: '0 12px', borderRadius: 10, fontSize: 14, lineHeight: '20px' }}
      >
        <span className={cn(
          'flex items-center justify-center w-7 h-7 shrink-0 transition-colors duration-[150ms]',
          active ? 'bg-white/10 text-white' : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]',
        )} style={{ borderRadius: 6 }}>
          {d.source === 'database' ? <Database className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-medium truncate" style={{ fontSize: 14, lineHeight: '20px' }}>
            {d.filename || d.name}
          </span>
          <span className="block truncate mt-px" style={{ fontSize: 12, lineHeight: '16px', opacity: 0.6 }}>
            {fmtInt(d.rows)} rows · {d.columns?.length ?? 0} columns · {formatBytes(d.size_kb)}
            {updated ? ` · ${formatDate(updated)}` : ''}
          </span>
        </span>

        <span className="flex items-center gap-1.5 shrink-0">
          <span className={cn(
            'hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium capitalize',
            statusTone[d.status] ?? 'text-[#94A3B8] bg-[#1E293B] border-[#334155]',
          )}>
            <span className="w-1 h-1 rounded-full bg-current shrink-0" />
            {d.status}
          </span>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => toggleFavorite(e, d.name)}
            aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
            className={cn(
              'p-1 rounded-md transition-colors shrink-0 focus:outline-none',
              isFav ? 'text-amber-400' : 'text-[#475569] opacity-0 group-hover:opacity-100',
              active && !isFav && 'opacity-100 text-white/50 hover:text-white',
              active && isFav && 'text-amber-300',
            )}
          >
            <Star className={cn('w-3.5 h-3.5', isFav && 'fill-current')} />
          </button>

          {isSelected && <Check className="w-4 h-4 shrink-0 text-[#60A5FA]" />}
        </span>
      </div>
    );
  };

  const renderSkeleton = () => (
    <div className="flex flex-col gap-1.5 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 animate-pulse" style={{ height: 40 }}>
          <div className="w-7 h-7 rounded-md bg-[#1E293B] shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-3 rounded-full bg-[#1E293B]" style={{ width: `${55 + (i % 3) * 12}%` }} />
            <div className="h-2.5 rounded-full bg-[#1E293B]/60" style={{ width: `${35 + (i % 2) * 15}%` }} />
          </div>
        </div>
      ))}
    </div>
  );

  const sectionMap = visible.sections.length > 0 ? visible.sections : null;

  const triggerContent = selected ? (
    <span className="flex items-center gap-2.5 min-w-0">
      <span className="flex items-center justify-center w-7 h-7 rounded-md bg-[#1E293B] border border-[#334155] shrink-0">
        <FileText className="w-3.5 h-3.5 text-[#94A3B8]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[#E2E8F0] truncate" style={{ fontSize: 14 }}>{selected.filename || selected.name}</span>
        <span className="block text-[12px] text-[#94A3B8] truncate">
          {fmtInt(selected.rows)} rows · {selected.columns?.length ?? 0} columns
        </span>
      </span>
    </span>
  ) : (
    <span className="flex items-center gap-2.5">
      <span className="flex items-center justify-center w-7 h-7 rounded-md bg-[#1E293B] border border-[#334155] shrink-0">
        <FileText className="w-3.5 h-3.5 text-[#475569]" />
      </span>
      <span className="text-sm text-[#94A3B8]">{placeholder}</span>
    </span>
  );

  const popover = open && position && createPortal(
    <AnimatePresence>
      <motion.div
        ref={popoverRef}
        role="listbox"
        aria-label="Datasets"
        aria-activedescendant={highlight >= 0 && visible.flat[highlight] ? `ds-opt-${visible.flat[highlight].name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}` : undefined}
        initial={{ opacity: 0, scale: 0.98, y: position.openUp ? 6 : -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: position.openUp ? 4 : -4 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="fixed flex flex-col overflow-hidden backdrop-blur-[12px]"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          zIndex: 450,
          background: '#0F172A',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
          padding: 8,
        }}
      >
        <div
          className="flex items-center gap-2.5"
          style={{
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: 10,
            padding: '0 12px',
            height: 40,
            marginBottom: 6,
          }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: '#94A3B8' }} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search datasets…"
            className="w-full bg-transparent focus:outline-none"
            style={{ color: '#E2E8F0', fontSize: 14, lineHeight: '20px' }}
            aria-label="Search datasets"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); searchRef.current?.focus(); }}
              className="p-0.5 rounded-md shrink-0 focus:outline-none transition-colors duration-[150ms]"
              style={{ color: '#94A3B8' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#E2E8F0'; (e.currentTarget as HTMLElement).style.background = '#1E293B'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div ref={listRef} className="overflow-y-auto popover-scroll" style={{ maxHeight: 320 }}>
          {loading ? (
            renderSkeleton()
          ) : visible.flat.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ padding: '40px 16px' }}>
              <span style={{ fontSize: 32 }}>📂</span>
              <p className="font-medium" style={{ color: '#E2E8F0', fontSize: 14, lineHeight: '20px' }}>No datasets found</p>
              {q ? (
                <p style={{ color: '#94A3B8', fontSize: 12, lineHeight: '16px' }}>Try a different search term</p>
              ) : (
                <p style={{ color: '#94A3B8', fontSize: 12, lineHeight: '16px' }}>Upload a dataset to continue</p>
              )}
            </div>
          ) : sectionMap ? (
            sectionMap.map((section) => (
              <div key={section.label}>
                <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                  <section.icon className="w-3 h-3" style={{ color: '#475569' }} />
                  <span className="font-semibold uppercase tracking-wider" style={{ color: '#64748B', fontSize: 11, lineHeight: '16px' }}>
                    {section.label}
                  </span>
                </div>
                {section.items.map((d) => renderItem(d))}
              </div>
            ))
          ) : (
            visible.flat.map((d) => renderItem(d))
          )}
        </div>

        <div
          className="flex items-center justify-between"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '8px 12px',
            marginTop: 4,
          }}
        >
          <span style={{ color: '#64748B', fontSize: 11, lineHeight: '16px' }}>{datasets.length} datasets</span>
          <span className="flex items-center gap-1.5" style={{ color: '#475569', fontSize: 11, lineHeight: '16px' }}>
            <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 font-mono leading-none" style={{ border: '1px solid #334155', borderRadius: 4, background: '#1E293B', color: '#64748B', fontSize: 10 }}>↑↓</kbd>
            <span className="hidden sm:inline">navigate</span>
            <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 font-mono leading-none" style={{ border: '1px solid #334155', borderRadius: 4, background: '#1E293B', color: '#64748B', fontSize: 10 }}>esc</kbd>
            <span>close</span>
          </span>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-2 border px-4 text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'cursor-pointer',
          className,
        )}
        style={{
          background: open ? '#1E293B' : '#111827',
          borderColor: open ? '#334155' : '#334155',
          borderRadius: 12,
          height: 48,
          transition: 'background 150ms ease, border-color 150ms ease',
        }}
        onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = '#1E293B'; }}
        onMouseLeave={(e) => { if (!disabled && !open) (e.currentTarget as HTMLElement).style.background = '#111827'; }}
      >
        {triggerContent}
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform duration-200"
          style={{
            color: '#9CA3AF',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      {popover}
    </>
  );
}
