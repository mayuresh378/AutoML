import { useState, useMemo, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, Clock, Star, Pin, Search, Trash2, Copy, RotateCcw, ChevronDown, MoreHorizontal,
  X, Heart, Bookmark,
} from 'lucide-react';
import styles from './QueryHistory.module.css';
import { sqlService } from '../services/sqlEditor.service';
import { QueryHistoryItem } from '../types';

interface QueryHistoryProps {
  onRestoreQuery: (query: string) => void;
  onClose: () => void;
}

export const QueryHistory = memo(function QueryHistory({ onRestoreQuery, onClose }: QueryHistoryProps) {
  const [history, setHistory] = useState<QueryHistoryItem[]>(() => sqlService.getHistory());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'today' | 'yesterday' | 'favorites'>('all');

  const filtered = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    return history.filter((h) => {
      if (filter === 'today' && now - h.executedAt > day) return false;
      if (filter === 'yesterday' && (now - h.executedAt > 2 * day || now - h.executedAt < day)) return false;
      if (filter === 'favorites' && !h.favorite) return false;
      if (search && !h.query.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [history, filter, search]);

  const toggleFavorite = useCallback((id: string) => {
    const item = history.find((h) => h.id === id);
    if (item) {
      sqlService.updateHistory(id, { favorite: !item.favorite });
      setHistory((prev) => prev.map((h) => h.id === id ? { ...h, favorite: !h.favorite } : h));
    }
  }, [history]);

  const deleteItem = useCallback((id: string) => {
    sqlService.deleteHistory(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    sqlService.clearHistory();
    setHistory([]);
  }, []);

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
            <History className={styles.headerIcon} />
            <span className={styles.headerTitle}>Query History</span>
            <span className={styles.headerCount}>({history.length})</span>
          </div>
          <div className={styles.headerRight}>
            {['all', 'today', 'yesterday', 'favorites'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ''}`}
              >
                {f === 'favorites' ? '⭐' : f}
              </button>
            ))}
            <div className={styles.divider} />
            <button onClick={clearAll} className={styles.clearBtn}>Clear</button>
            <button onClick={onClose} className={styles.closeBtn}>
              <X className={styles.headerIcon} />
            </button>
          </div>
        </div>

        <div className={styles.searchArea}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search queries..."
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.list}>
          {filtered.length === 0 ? (
            <div className={styles.listEmpty}>No queries found</div>
          ) : (
            <div className={styles.listItems}>
              {filtered.map((item) => (
                <div key={item.id} className={styles.item}>
                  <div className={styles.itemRow}>
                    <div className={styles.itemContent}>
                      <pre className={styles.itemQuery}>{item.query}</pre>
                      <div className={styles.itemMeta}>
                        <span className={styles.itemTime}>
                          {new Date(item.executedAt).toLocaleString()}
                        </span>
                        {item.executionTime && (
                          <span className={styles.itemStat}>{item.executionTime}ms</span>
                        )}
                        {item.rowsReturned != null && (
                          <span className={styles.itemStat}>{item.rowsReturned} rows</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.itemActions}>
                      <button onClick={() => toggleFavorite(item.id)} className={styles.itemActionBtn}>
                        <Heart className={`${styles.heartIcon} ${item.favorite ? styles.heartFilled : ''}`} />
                      </button>
                      <button onClick={() => { onRestoreQuery(item.query); }} className={styles.itemActionBtn}>
                        <RotateCcw className={styles.heartIcon} />
                      </button>
                      <button onClick={() => deleteItem(item.id)} className={`${styles.itemActionBtn} ${styles.itemActionBtnDanger}`}>
                        <Trash2 className={styles.heartIcon} />
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
