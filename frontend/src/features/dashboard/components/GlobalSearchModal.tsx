// GlobalSearchModal - Corrected Framer Motion imports
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, Database, Cpu, FlaskConical, Folder, Command, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

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

  const mockItems = [
    { title: 'Customer Churn Prediction', type: 'project', category: 'PROJECTS', path: '/app/projects', icon: Folder },
    { title: 'customer_data.csv', type: 'dataset', category: 'DATASETS', path: '/app/datasets', icon: Database },
    { title: 'customer_churn_xgb_v3', type: 'model', category: 'MODELS', path: '/app/models', icon: Cpu },
    { title: 'Iris Classification Experiment #12', type: 'experiment', category: 'EXPERIMENTS', path: '/app/experiments', icon: FlaskConical },
    { title: 'housing_data.csv', type: 'dataset', category: 'DATASETS', path: '/app/datasets', icon: Database },
    { title: 'random_forest_regressor_v1', type: 'model', category: 'MODELS', path: '/app/models', icon: Cpu },
  ];

  const filtered = query.trim()
    ? mockItems.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
    : mockItems;

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
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
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
