// GlobalSearchModal - uses real global search API
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, Database, Cpu, FlaskConical, Folder, Command, X, Loader2, FileText, Boxes } from 'lucide-react';
import { useGlobalSearch } from '../../../hooks/useApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  title: string;
  category: string;
  path: string;
  icon: any;
}

export default function GlobalSearchModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { data: searchResults, isFetching } = useGlobalSearch(query);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items: SearchItem[] = [];
  if (searchResults) {
    (searchResults.projects || []).forEach((p: any) =>
      items.push({ title: p.name || '', category: 'PROJECTS', path: '/app/projects', icon: Folder }));
    (searchResults.datasets || []).forEach((d: any) =>
      items.push({ title: d.filename || '', category: 'DATASETS', path: '/app/datasets', icon: Database }));
    (searchResults.models || []).forEach((m: any) =>
      items.push({ title: m.name || m.filename || '', category: 'MODELS', path: '/app/models', icon: Cpu }));
    (searchResults.registry_models || []).forEach((m: any) =>
      items.push({ title: m.name || '', category: 'MODELS', path: '/app/models', icon: Boxes }));
    (searchResults.experiments || []).forEach((e: any) =>
      items.push({ title: e.name || '', category: 'EXPERIMENTS', path: '/app/experiments', icon: FlaskConical }));
    (searchResults.predictions || []).forEach((p: any) =>
      items.push({ title: p.model_name || '', category: 'PREDICTIONS', path: '/app/monitoring', icon: FileText }));
  }

  const filtered = query.trim()
    ? items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
    : items.slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
      <div
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-zinc-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-zinc-400 ml-1" />
          <input
            type="text"
            autoFocus
            placeholder="Search projects, datasets, models, experiments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          {isFetching && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin flex-shrink-0" />}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {!query.trim() ? (
            <div className="p-6 text-center text-xs text-zinc-500 font-mono">
              Type to search across your workspace
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500 font-mono">
              No matching resources found for "{query}"
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    navigate(item.path);
                    onClose();
                  }}
                  className="p-2.5 rounded-lg hover:bg-zinc-800/80 flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-zinc-800 group-hover:bg-zinc-700 text-zinc-300 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors block">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">{item.category}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">
                    Jump to →
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="p-2.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">K</kbd> to toggle</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Esc</kbd> to close</span>
          </div>
          <span>AutoML Cloud Search</span>
        </div>
      </div>
    </div>
  );
}
