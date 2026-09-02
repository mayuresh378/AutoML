import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Upload, Cpu, FlaskConical, Rocket, FileText, Users, FolderOpen, Database, Box, Loader2, ArrowRight } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useGlobalSearch } from '../hooks/useApi';

const ACTIONS = [
  { icon: Upload, label: 'Upload a new dataset', page: 'Datasets', hint: 'Data' },
  { icon: Cpu, label: 'Start a new training run', page: 'Training', hint: 'Training' },
  { icon: FlaskConical, label: 'Open recent experiments', page: 'Experiments', hint: 'Experiments' },
  { icon: Rocket, label: 'Deploy a model', page: 'Deployment', hint: 'Deployment' },
  { icon: FileText, label: 'Read the documentation', page: 'Documentation', hint: 'Docs' },
];

const SECTION_ICONS: Record<string, any> = {
  users: Users,
  projects: FolderOpen,
  datasets: Database,
  models: Box,
};

const SECTION_NAV: Record<string, string> = {
  users: 'Settings',
  projects: 'Projects',
  datasets: 'Datasets',
  models: 'Models',
};

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setActivePage } = useUIStore();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: searchResults, isFetching } = useGlobalSearch(debounced);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape') setCommandPaletteOpen(false);
      if (!commandPaletteOpen) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, allItems.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && allItems[activeIndex]) {
        const item = allItems[activeIndex];
        if ('page' in item) {
          handleAction(item.page);
        } else {
          setCommandPaletteOpen(false);
          if (item.section && SECTION_NAV[item.section]) setActivePage(SECTION_NAV[item.section]);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commandPaletteOpen, setCommandPaletteOpen, activeIndex, query]);

  const handleAction = useCallback((page: string) => {
    setCommandPaletteOpen(false);
    if (page) setActivePage(page);
  }, [setCommandPaletteOpen, setActivePage]);

  const filteredActions = query ? ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase())) : ACTIONS;

  const searchItems = searchResults
    ? Object.entries(searchResults).flatMap(([section, items]: [string, any[]]) =>
        (items || []).slice(0, 4).map((item: any) => ({
          section,
          label: item.name || item.filename || item.email || item.path || 'Unknown',
          sublabel: section === 'users' ? item.email : section === 'projects' ? item.description || '' : section === 'datasets' ? `${item.rows || '?'} rows` : '',
          icon: SECTION_ICONS[section],
        }))
      )
    : [];

  const showSearch = debounced.length >= 2 && searchItems.length > 0;
  const showActions = !debounced || filteredActions.length > 0;

  const allItems = showSearch
    ? searchItems
    : showActions
    ? filteredActions.map(a => ({ ...a, section: 'action' }))
    : [];

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setCommandPaletteOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border-strong bg-card shadow-glow overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search datasets, projects, models…"
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
              />
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              ) : (
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border-strong text-zinc-500">esc</kbd>
              )}
            </div>

            <div className="py-1.5 max-h-80 overflow-y-auto scrollbar-thin">
              {showSearch && (
                <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Search results</div>
              )}
              {showSearch && searchItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={`search-${item.section}-${item.label}`}
                    onClick={() => { setCommandPaletteOpen(false); if (SECTION_NAV[item.section]) setActivePage(SECTION_NAV[item.section]); }}
                    className={`btn-press w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      activeIndex === i ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.sublabel && <span className="text-xs text-zinc-600 truncate max-w-[120px]">{item.sublabel}</span>}
                    <ArrowRight className="h-3 w-3 text-zinc-600 shrink-0" />
                  </button>
                );
              })}

              {showSearch && showActions && <div className="mx-3 my-1 border-t border-border" />}

              {showActions && !searchItems.length && (
                <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Commands</div>
              )}
              {showActions && filteredActions.map((action, i) => {
                const Icon = action.icon;
                const idx = showSearch ? searchItems.length + i : i;
                return (
                  <button
                    key={action.label}
                    onClick={() => handleAction(action.page)}
                    className={`btn-press w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      activeIndex === idx ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-zinc-500" />
                    <span className="flex-1 text-left">{action.label}</span>
                    <span className="text-xs text-zinc-600">{action.hint}</span>
                  </button>
                );
              })}

              {!showActions && !showSearch && debounced.length >= 2 && (
                <div className="px-4 py-6 text-center text-sm text-zinc-500">No results found.</div>
              )}
              {!debounced && (
                <div className="px-4 py-6 text-center text-sm text-zinc-500">Type at least 2 characters to search across projects, datasets, and models.</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}