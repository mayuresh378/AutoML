import { useState, useMemo, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bookmark, Search, Trash2, RotateCcw, X, Pin, Pencil, Folder,
} from 'lucide-react';
import styles from './SavedQueriesPanel.module.css';
import { sqlService } from '../services/sqlEditor.service';
import { SavedQuery } from '../types';

interface SavedQueriesPanelProps {
  onRestoreQuery: (query: string) => void;
  onClose: () => void;
}

export const SavedQueriesPanel = memo(function SavedQueriesPanel({ onRestoreQuery, onClose }: SavedQueriesPanelProps) {
  const [queries, setQueries] = useState<SavedQuery[]>(() => sqlService.getSavedQueries());
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const filtered = useMemo(() => {
    return queries.filter((q) => {
      if (search) {
        const s = search.toLowerCase();
        return q.name.toLowerCase().includes(s) || q.query.toLowerCase().includes(s) || q.tags.some((t) => t.toLowerCase().includes(s));
      }
      return true;
    });
  }, [queries, search]);

  const handleDelete = useCallback((id: string) => {
    sqlService.deleteSavedQuery(id);
    setQueries((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const handleTogglePin = useCallback((id: string) => {
    const item = queries.find((q) => q.id === id);
    if (item) {
      sqlService.updateSavedQuery(id, { pinned: !item.pinned });
      setQueries((prev) => prev.map((q) => q.id === id ? { ...q, pinned: !q.pinned } : q));
    }
  }, [queries]);

  const handleRename = useCallback((id: string) => {
    if (renameValue.trim()) {
      sqlService.updateSavedQuery(id, { name: renameValue.trim() });
      setQueries((prev) => prev.map((q) => q.id === id ? { ...q, name: renameValue.trim() } : q));
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue]);

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
          {filtered.length === 0 ? (
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
