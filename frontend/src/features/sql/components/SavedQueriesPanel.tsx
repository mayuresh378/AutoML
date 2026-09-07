import { useState, useMemo, memo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bookmark, Search, Trash2, RotateCcw, X, Pin, Pencil, Folder, Loader2, AlertCircle,
} from 'lucide-react';
import styles from './SavedQueriesPanel.module.css';
import { sqlService } from '../services/sqlEditor.service';
import { SavedQuery } from '../types';

interface SavedQueriesPanelProps {
  onRestoreQuery: (query: string) => void;
  onClose: () => void;
}

export const SavedQueriesPanel = memo(function SavedQueriesPanel({ onRestoreQuery, onClose }: SavedQueriesPanelProps) {
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setQueries(await sqlService.listSaved());
    } catch (err: any) {
      setLoadError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return queries.filter((q) => {
      if (search) {
        const s = search.toLowerCase();
        return q.name.toLowerCase().includes(s) || q.query.toLowerCase().includes(s) || q.tags.some((t) => t.toLowerCase().includes(s));
      }
      return true;
    });
  }, [queries, search]);

  const handleDelete = useCallback(async (id: string) => {
    const prev = queries;
    setQueries((p) => p.filter((q) => q.id !== id));
    try {
      await sqlService.deleteSavedQuery(id);
    } catch (err: any) {
      setQueries(prev);
    }
  }, [queries]);

  const handleTogglePin = useCallback(async (id: string) => {
    const item = queries.find((q) => q.id === id);
    if (item) {
      const next = !item.pinned;
      setQueries((prev) => prev.map((q) => q.id === id ? { ...q, pinned: next } : q));
      try {
        await sqlService.updateSavedQuery(id, { pinned: next });
      } catch (err: any) {
        setQueries((prev) => prev.map((q) => q.id === id ? { ...q, pinned: item.pinned } : q));
      }
    }
  }, [queries]);

  const handleRename = useCallback(async (id: string) => {
    const name = renameValue.trim();
    if (name) {
      const prev = queries.find((q) => q.id === id)?.name;
      setQueries((p) => p.map((q) => q.id === id ? { ...q, name } : q));
      try {
        await sqlService.updateSavedQuery(id, { name });
      } catch (err: any) {
        if (prev !== undefined) setQueries((p) => p.map((q) => q.id === id ? { ...q, name: prev } : q));
      }
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, queries]);

  return (
    <div className={styles.backdrop}>
      <div className={styles.overlay} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={styles.modal}
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Bookmark className={styles.headerIcon} />
            <span className={styles.headerTitle}>Saved Queries</span>
            <span className={styles.headerCount}>({queries.length})</span>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X className={styles.headerIcon} />
          </button>
        </div>

        <div className={styles.searchArea}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search saved queries..."
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.listEmpty}>
              <Loader2 size={16} className={styles.loadingSpin} /> Loading saved queries...
            </div>
          ) : loadError ? (
            <div className={styles.listEmpty}>
              <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {loadError}
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.listEmpty}>
              {queries.length === 0
                ? 'No saved queries yet. Use Ctrl+S to save.'
                : 'No queries match your search'}
            </div>
          ) : (
            <div className={styles.listItems}>
              {filtered.map((item) => (
                <div key={item.id} className={styles.item}>
                  <div className={styles.itemRow}>
                    <div className={styles.itemContent}>
                      {renamingId === item.id ? (
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(item.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          onBlur={() => handleRename(item.id)}
                          className={styles.renameInput}
                          autoFocus
                        />
                      ) : (
                        <div className={styles.itemName}>
                          <Folder className={styles.itemFolder} />
                          {item.name}
                          {item.pinned && <Pin className={styles.itemPin} />}
                        </div>
                      )}
                      <pre className={styles.itemQuery}>{item.query}</pre>
                      <div className={styles.itemMeta}>
                        <span className={styles.itemTime}>
                          {new Date(item.updatedAt).toLocaleString()}
                        </span>
                        {item.dataset && (
                          <span className={styles.itemDataset}>{item.dataset}</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.itemActions}>
                      <button onClick={() => { onRestoreQuery(item.query); onClose(); }} className={styles.itemActionBtn} title="Load query">
                        <RotateCcw className={styles.actionIcon} />
                      </button>
                      <button onClick={() => handleTogglePin(item.id)} className={styles.itemActionBtn} title="Toggle pin">
                        <Pin className={`${styles.actionIcon} ${item.pinned ? styles.pinActive : ''}`} />
                      </button>
                      <button
                        onClick={() => { setRenamingId(item.id); setRenameValue(item.name); }}
                        className={styles.itemActionBtn}
                        title="Rename"
                      >
                        <Pencil className={styles.actionIcon} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className={`${styles.itemActionBtn} ${styles.itemActionBtnDanger}`} title="Delete">
                        <Trash2 className={styles.actionIcon} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
});
