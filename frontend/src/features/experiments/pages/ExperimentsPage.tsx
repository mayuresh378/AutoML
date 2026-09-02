import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  Layers,
  Beaker,
  Pencil,
  X,
  Check,
  Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useExperiments } from '../../../hooks/useApi';
import { experimentsService } from '../../../services/experiments.service';
import type { Experiment } from '../../../types/api';
import styles from './ExperimentsPage.module.css';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.04 } },
};

const rowVariant = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  return `${(val * 100).toFixed(1)}%`;
}

function percentColor(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'var(--color-text-tertiary)';
  if (val >= 0.93) return 'var(--color-success)';
  if (val >= 0.85) return 'var(--color-accent)';
  return 'var(--color-warning)';
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function getMetric(exp: Experiment, key: string): number | null {
  if (!exp.metrics) return null;
  const val = exp.metrics[key];
  return typeof val === 'number' ? val : null;
}

function truncateParams(params: Record<string, any> | undefined): string {
  if (!params) return '—';
  const entries = Object.entries(params);
  if (entries.length === 0) return '—';
  const str = entries.map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
  return str.length > 50 ? str.slice(0, 47) + '...' : str;
}

export default function ExperimentsPage() {
  const queryClient = useQueryClient();
  const { data: experiments = [], isLoading } = useExperiments();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareData, setCompareData] = useState<Experiment[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);

  const filtered = useMemo(() => {
    let result = experiments;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.model.toLowerCase().includes(q) ||
          (e.dataset || '').toLowerCase().includes(q),
      );
    }
    if (statusFilter) {
      result = result.filter((e) => e.status === statusFilter);
    }
    return result;
  }, [experiments, search, statusFilter]);

  const stats = useMemo(() => ({
    total: experiments.length,
    running: experiments.filter((e) => e.status === 'running').length,
    completed: experiments.filter((e) => e.status === 'completed' || e.status === 'success').length,
    failed: experiments.filter((e) => e.status === 'failed').length,
  }), [experiments]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((e) => e.id)));
    }
  }, [selected.size, filtered]);

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  async function handleCompare() {
    const ids = Array.from(selected);
    if (ids.length < 2) return;
    setCompareLoading(true);
    setCompareOpen(true);
    try {
      const res = await experimentsService.compare(ids);
      setCompareData(res.experiments || []);
    } catch {
      setCompareData([]);
    } finally {
      setCompareLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await experimentsService.delete(id);
    queryClient.invalidateQueries({ queryKey: ['experiments'] });
  }

  function startEditNotes(exp: Experiment) {
    setEditingNotes(exp.id);
    setNotesValue(exp.notes || '');
  }

  function cancelEditNotes() {
    setEditingNotes(null);
    setNotesValue('');
  }

  async function saveNotes(id: string) {
    await experimentsService.update(id, { notes: notesValue });
    queryClient.invalidateQueries({ queryKey: ['experiments'] });
    setEditingNotes(null);
  }

  return (
    <div className={styles.page}>
      <motion.div className={styles.header} initial="hidden" animate="visible" variants={fadeIn}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Experiments</h1>
          <p className={styles.subtitle}>Track, compare, and manage your training runs</p>
        </div>
      </motion.div>

      <motion.div
        className={styles.statsBar}
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div className={styles.statCard} variants={fadeIn}>
          <div className={`${styles.statIconWrap} ${styles.statIconWrapTotal}`}>
            <Layers size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Total Experiments</span>
          </div>
        </motion.div>
        <motion.div className={styles.statCard} variants={fadeIn}>
          <div className={`${styles.statIconWrap} ${styles.statIconWrapRunning}`}>
            <Play size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.running}</span>
            <span className={styles.statLabel}>Running</span>
          </div>
        </motion.div>
        <motion.div className={styles.statCard} variants={fadeIn}>
          <div className={`${styles.statIconWrap} ${styles.statIconWrapCompleted}`}>
            <CheckCircle2 size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.completed}</span>
            <span className={styles.statLabel}>Completed</span>
          </div>
        </motion.div>
        <motion.div className={styles.statCard} variants={fadeIn}>
          <div className={`${styles.statIconWrap} ${styles.statIconWrapFailed}`}>
            <XCircle size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.failed}</span>
            <span className={styles.statLabel}>Failed</span>
          </div>
        </motion.div>
      </motion.div>

      <motion.div className={styles.toolbar} initial="hidden" animate="visible" variants={fadeIn}>
        <div className={styles.toolbarLeft}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search experiments, models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {['running', 'success', 'completed', 'failed'].map((s) => (
            <button
              key={s}
              className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
              type="button"
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.toolbarRight}>
          <AnimatePresence>
            {selected.size >= 2 && (
              <motion.button
                className={styles.compareBtn}
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                onClick={handleCompare}
              >
                <FlaskConical size={16} />
                Compare Selected ({selected.size})
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.div
        className={styles.tableWrap}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        {isLoading ? (
          <div className={styles.emptyState}>
            <Beaker className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Loading experiments...</p>
          </div>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead className={styles.tableHead}>
                  <tr>
                    <th className={styles.checkboxCell}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={allSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Model</th>
                    <th>Accuracy</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1</th>
                    <th>ROC AUC</th>
                    <th>Dataset</th>
                    <th>Dataset Version</th>
                    <th>Target</th>
                    <th>Training Time</th>
                    <th>Hyperparameters</th>
                    <th>User</th>
                    <th>Date</th>
                    <th>Notes</th>
                    <th className={styles.actionsHead}>Actions</th>
                  </tr>
                </thead>
                <tbody className={styles.tableBody}>
                  <AnimatePresence mode="popLayout">
                    {filtered.map((exp) => (
                      <motion.tr
                        key={exp.id}
                        variants={rowVariant}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        layout
                      >
                        <td className={styles.checkboxCell}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={selected.has(exp.id)}
                            onChange={() => toggleSelect(exp.id)}
                          />
                        </td>
                        <td>
                          <div className={styles.nameCell}>
                            <span className={styles.experimentName}>{exp.model}</span>
                            <span className={styles.experimentDataset}>{exp.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.accuracyCell}>
                            <div className={styles.accuracyBar}>
                              <div
                                className={styles.accuracyFill}
                                style={{
                                  width: getMetric(exp, 'accuracy') != null ? `${(getMetric(exp, 'accuracy') ?? 0) * 100}%` : '0%',
                                  background: percentColor(getMetric(exp, 'accuracy')),
                                }}
                              />
                            </div>
                            <span className={styles.accuracyValue} style={{ color: percentColor(getMetric(exp, 'accuracy')) }}>
                              {formatPercent(getMetric(exp, 'accuracy'))}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={styles.metricValue}>{formatPercent(getMetric(exp, 'precision'))}</span>
                        </td>
                        <td>
                          <span className={styles.metricValue}>{formatPercent(getMetric(exp, 'recall'))}</span>
                        </td>
                        <td>
                          <span className={styles.metricValue}>{formatPercent(getMetric(exp, 'f1'))}</span>
                        </td>
                        <td>
                          <span className={styles.metricValue}>{formatPercent(getMetric(exp, 'roc_auc'))}</span>
                        </td>
                        <td>
                          <span className={styles.modelBadge}>{exp.dataset || '—'}</span>
                        </td>
                        <td>
                          <span className={styles.monoText}>{exp.dataset_version || '—'}</span>
                        </td>
                        <td>
                          <span className={styles.monoText}>{exp.target || '—'}</span>
                        </td>
                        <td>
                          <span className={styles.monoText}>{formatDuration(exp.training_time)}</span>
                        </td>
                        <td>
                          <span className={styles.paramText} title={JSON.stringify(exp.params)}>
                            {truncateParams(exp.params)}
                          </span>
                        </td>
                        <td>
                          <span className={styles.monoText}>{exp.user_id ? exp.user_id.slice(0, 8) : '—'}</span>
                        </td>
                        <td>
                          {editingNotes === exp.id ? (
                            <div className={styles.notesEdit}>
                              <input
                                className={styles.notesInput}
                                type="text"
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveNotes(exp.id);
                                  if (e.key === 'Escape') cancelEditNotes();
                                }}
                                autoFocus
                              />
                              <button className={styles.notesSaveBtn} onClick={() => saveNotes(exp.id)}>
                                <Check size={14} />
                              </button>
                              <button className={styles.notesCancelBtn} onClick={cancelEditNotes}>
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className={styles.notesCell} onClick={() => startEditNotes(exp)}>
                              <span className={styles.notesText}>{exp.notes || <span className={styles.notesPlaceholder}>Add note...</span>}</span>
                              <Pencil size={12} className={styles.notesEditIcon} />
                            </div>
                          )}
                        </td>
                        <td>
                          <div className={styles.dateCell}>
                            <span className={styles.dateText}>{formatDate(exp.run_at || exp.created_at)}</span>
                            <span className={styles.timeText}>{formatTime(exp.run_at || exp.created_at)}</span>
                          </div>
                        </td>
                        <td className={styles.actionsCell}>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(exp.id)}
                            title="Delete experiment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div className={styles.emptyState}>
                <Beaker className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No experiments found</p>
                <p className={styles.emptyDesc}>
                  {search ? 'Try a different search term or filter' : 'Create your first experiment to get started'}
                </p>
              </div>
            )}

            {filtered.length > 0 && (
              <div className={styles.resultCount}>
                Showing {filtered.length} of {experiments.length} experiments
                {selected.size > 0 && ` · ${selected.size} selected`}
              </div>
            )}
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {compareOpen && (
          <motion.div
            className={styles.compareOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCompareOpen(false)}
          >
            <motion.div
              className={styles.comparePanel}
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.compareHeader}>
                <h2 className={styles.compareTitle}>
                  <FlaskConical size={20} />
                  Compare Experiments ({compareData.length})
                </h2>
                <button className={styles.compareClose} onClick={() => setCompareOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className={styles.compareBody}>
                {compareLoading ? (
                  <div className={styles.compareLoading}>Loading comparison...</div>
                ) : (
                  <table className={styles.compareTable}>
                    <thead>
                      <tr>
                        <th className={styles.compareMetricLabel}>Metric</th>
                        {compareData.map((exp) => (
                          <th key={exp.id} className={styles.compareExpHeader}>
                            <div className={styles.compareExpName}>{exp.model}</div>
                            <div className={styles.compareExpDataset}>{exp.dataset}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Accuracy', key: 'accuracy' },
                        { label: 'Precision', key: 'precision' },
                        { label: 'Recall', key: 'recall' },
                        { label: 'F1 Score', key: 'f1' },
                        { label: 'ROC AUC', key: 'roc_auc' },
                        { label: 'CV Score', key: '_cv_score' },
                        { label: 'Training Time', key: '_training_time' },
                        { label: 'Task Type', key: '_task_type' },
                        { label: 'Dataset Version', key: '_dataset_version' },
                        { label: 'User', key: '_user_id' },
                        { label: 'Status', key: '_status' },
                        { label: 'Notes', key: '_notes' },
                      ].map((row) => (
                        <tr key={row.key}>
                          <td className={styles.compareMetricLabel}>{row.label}</td>
                          {compareData.map((exp) => {
                            let val: string;
                            if (row.key === '_cv_score') val = formatPercent(exp.cv_score);
                            else if (row.key === '_training_time') val = formatDuration(exp.training_time);
                            else if (row.key === '_task_type') val = exp.task_type || '—';
                            else if (row.key === '_dataset_version') val = exp.dataset_version || '—';
                            else if (row.key === '_user_id') val = exp.user_id ? exp.user_id.slice(0, 8) : '—';
                            else if (row.key === '_status') val = exp.status;
                            else if (row.key === '_notes') val = exp.notes || '—';
                            else {
                              const m = getMetric(exp, row.key);
                              val = formatPercent(m);
                            }
                            return (
                              <td key={exp.id} className={styles.compareValue}>{val}</td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr>
                        <td className={styles.compareMetricLabel}>Hyperparameters</td>
                        {compareData.map((exp) => (
                          <td key={exp.id} className={styles.compareValue}>
                            <span className={styles.compareParams}>{JSON.stringify(exp.params || {}, null, 2)}</span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
