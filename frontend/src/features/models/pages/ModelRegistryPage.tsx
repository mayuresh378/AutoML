import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search, Rocket, Tag, Clock, ChevronRight, Box, CheckCircle, AlertTriangle,
  Archive, ArrowUpCircle, Download, Trash2, MoreVertical, X, Database, Layers,
  RefreshCw, BarChart3, Filter,
} from 'lucide-react';
import { useModels, usePromoteModel, useArchiveModel, useDeleteModel } from '../../../hooks/useApi';
import { modelsService } from '../../../services/models.service';
import type { Model } from '../../../types/api';
import styles from './ModelRegistryPage.module.css';

const STATUS_TABS = ['All', 'Production', 'Staging', 'Archived'] as const;
type StatusFilter = typeof STATUS_TABS[number];

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  production: { bg: 'rgba(34,197,94,0.08)', text: '#22c55e', border: 'rgba(34,197,94,0.2)' },
  staging: { bg: 'rgba(99,102,241,0.08)', text: '#6366f1', border: 'rgba(99,102,241,0.2)' },
  archived: { bg: 'rgba(107,114,128,0.08)', text: '#6b7280', border: 'rgba(107,114,128,0.2)' },
  registered: { bg: 'rgba(6,182,212,0.08)', text: '#06b6d4', border: 'rgba(6,182,212,0.2)' },
  training: { bg: 'rgba(245,158,11,0.08)', text: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  ready: { bg: 'rgba(34,197,94,0.08)', text: '#22c55e', border: 'rgba(34,197,94,0.2)' },
  failed: { bg: 'rgba(239,68,68,0.08)', text: '#ef4444', border: 'rgba(239,68,68,0.2)' },
  deployed: { bg: 'rgba(34,197,94,0.08)', text: '#22c55e', border: 'rgba(34,197,94,0.2)' },
  not_deployed: { bg: 'rgba(107,114,128,0.08)', text: '#6b7280', border: 'rgba(107,114,128,0.2)' },
};

const algorithmGradients: Record<string, string> = {
  'XGBoost': 'linear-gradient(135deg, #ef4444, #b91c1c)',
  'Random Forest': 'linear-gradient(135deg, #22c55e, #16a34a)',
  'Gradient Boosting': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  'LightGBM': 'linear-gradient(135deg, #14b8a6, #0d9488)',
  'CatBoost': 'linear-gradient(135deg, #a855f7, #9333ea)',
  'Decision Tree': 'linear-gradient(135deg, #f97316, #ea580c)',
  'Logistic Regression': 'linear-gradient(135deg, #ec4899, #db2777)',
  'Naive Bayes': 'linear-gradient(135deg, #64748b, #475569)',
  'LSTM': 'linear-gradient(135deg, #06b6d4, #0891b2)',
  'BERT': 'linear-gradient(135deg, #f59e0b, #d97706)',
};
const defaultGradient = 'linear-gradient(135deg, #6366f1, #8b5cf6)';

function getGradient(algorithm?: string): string {
  if (!algorithm) return defaultGradient;
  if (algorithmGradients[algorithm]) return algorithmGradients[algorithm];
  for (const [key, value] of Object.entries(algorithmGradients)) {
    if (algorithm.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return defaultGradient;
}

function formatRelative(dateString?: string): string {
  if (!dateString) return '—';
  const diff = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return 'just now';
}

function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] || statusColors.staging;
  return (
    <span className={styles.statusBadge} style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      {status}
    </span>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <motion.div className={styles.dialog} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className={styles.dialogActions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>Confirm</button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ModelRegistryPage() {
  const { data: models, isLoading, error } = useModels();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; name: string } | null>(null);
  const promote = usePromoteModel();
  const archive = useArchiveModel();
  const deleteModel = useDeleteModel();
  const qc = useQueryClient();

  const allModels = models ?? [];

  const filteredModels = useMemo(() => {
    return allModels.filter((m: Model) => {
      const matchesStatus = activeFilter === 'All' ||
        (activeFilter === 'Production' && (m.status === 'production' || m.status === 'ready')) ||
        (activeFilter === 'Staging' && (m.status === 'staging' || m.status === 'registered' || m.status === 'training')) ||
        (activeFilter === 'Archived' && m.status === 'archived');
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || m.name.toLowerCase().includes(q) ||
        (m.model_type && m.model_type.toLowerCase().includes(q)) ||
        (m.task_type && m.task_type.toLowerCase().includes(q)) ||
        (m.dataset_name && m.dataset_name.toLowerCase().includes(q)) ||
        (m.tags && m.tags.some((t: string) => t.toLowerCase().includes(q)));
      return matchesStatus && matchesSearch;
    });
  }, [allModels, activeFilter, searchQuery]);

  const stats = useMemo(() => ({
    total: allModels.length,
    inProduction: allModels.filter((m: Model) => m.status === 'production' || m.status === 'ready').length,
    latestVersion: allModels.reduce((max: number, m: Model) => Math.max(max, m.version || 0), 0),
    avgAccuracy: allModels.length
      ? Math.round(allModels.reduce((s: number, m: Model) => s + (m.cv_score || 0), 0) / allModels.length * 1000) / 10
      : 0,
  }), [allModels]);

  const filterCounts = useMemo(() => ({
    All: allModels.length,
    Production: allModels.filter((m: Model) => m.status === 'production' || m.status === 'ready').length,
    Staging: allModels.filter((m: Model) => m.status === 'staging' || m.status === 'registered' || m.status === 'training').length,
    Archived: allModels.filter((m: Model) => m.status === 'archived').length,
  }), [allModels]);

  const handleAction = useCallback((type: string, name: string) => {
    setMenuOpenId(null);
    if (type === 'delete') {
      setConfirmAction({ type, name });
    } else if (type === 'promote') {
      promote.mutate(name);
    } else if (type === 'archive') {
      setConfirmAction({ type, name });
    }
  }, [promote, archive]);

  const executeConfirm = useCallback(() => {
    if (!confirmAction) return;
    if (confirmAction.type === 'delete') deleteModel.mutate(confirmAction.name);
    else if (confirmAction.type === 'archive') archive.mutate(confirmAction.name);
    setConfirmAction(null);
  }, [confirmAction, deleteModel, archive]);

  return (
    <div className={styles.page}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Model Registry</h1>
            <p className={styles.subtitle}>Version, track, and manage your trained models</p>
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTop}>
              <span className={styles.summaryLabel}>Total Models</span>
              <div className={`${styles.summaryIcon} ${styles.summaryIconPrimary}`}><Box size={18} /></div>
            </div>
            <div className={styles.summaryValue}>{stats.total}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTop}>
              <span className={styles.summaryLabel}>In Production</span>
              <div className={`${styles.summaryIcon} ${styles.summaryIconSuccess}`}><Rocket size={18} /></div>
            </div>
            <div className={styles.summaryValue}>{stats.inProduction}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTop}>
              <span className={styles.summaryLabel}>Latest Version</span>
              <div className={`${styles.summaryIcon} ${styles.summaryIconInfo}`}><Layers size={18} /></div>
            </div>
            <div className={styles.summaryValue}>v{stats.latestVersion}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTop}>
              <span className={styles.summaryLabel}>Avg Accuracy</span>
              <div className={`${styles.summaryIcon} ${styles.summaryIconWarning}`}><BarChart3 size={18} /></div>
            </div>
            <div className={styles.summaryValue}>{stats.avgAccuracy}%</div>
          </div>
        </div>

        <div className={styles.filterBar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input className={styles.searchInput} placeholder="Search models, algorithms, datasets..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className={styles.filterTabs}>
            {STATUS_TABS.map((tab) => (
              <button key={tab} className={`${styles.filterTab} ${activeFilter === tab ? styles.filterTabActive : ''}`}
                onClick={() => setActiveFilter(tab)}>
                {tab}
                <span className={styles.filterCount}>{filterCounts[tab]}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className={styles.emptyState}><RefreshCw size={20} className={styles.spin} /> Loading models...</div>
        ) : error ? (
          <div className={styles.emptyState}><AlertTriangle size={24} /> Failed to load models</div>
        ) : filteredModels.length === 0 ? (
          <div className={styles.emptyState}><Box size={32} /><p>No models found</p>
            <span>{searchQuery ? 'Try a different search term.' : 'Train a model to get started.'}</span></div>
        ) : (
          <div className={styles.modelGrid}>
            {filteredModels.map((model: Model, i: number) => (
              <motion.div key={model.id || model.name} className={styles.modelCard}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}>

                <div className={styles.cardTopRow}>
                  <div className={styles.cardIcon} style={{ background: getGradient(model.model_type || model.algorithm) }}>
                    <Box size={20} color="white" />
                  </div>
                  <div className={styles.cardHeader}>
                    <StatusBadge status={model.status} />
                    {model.deployment_status === 'deployed' && (
                      <span className={styles.deployBadge}>Deployed</span>
                    )}
                  </div>
                </div>

                <h3 className={styles.modelName}>{model.name}</h3>

                <div className={styles.modelMeta}>
                  {(model.model_type || model.algorithm) && (
                    <span className={styles.algorithmBadge}>{model.model_type || model.algorithm}</span>
                  )}
                  <span className={styles.versionText}>v{model.version}</span>
                  {model.owner && <span className={styles.ownerBadge}>{model.owner}</span>}
                </div>

                <div className={styles.metricsRow}>
                  {model.cv_score != null && (
                    <div className={styles.metric}>
                      <span className={styles.metricValue}>{(model.cv_score * 100).toFixed(1)}%</span>
                      <span className={styles.metricLabel}>Accuracy</span>
                    </div>
                  )}
                  <div className={styles.metricDivider} />
                  <div className={styles.metric}>
                    <span className={styles.metricValue}>{model.file_size_kb ?? model.size_kb ?? '—'}KB</span>
                    <span className={styles.metricLabel}>Size</span>
                  </div>
                  <div className={styles.metricDivider} />
                  <div className={styles.metric}>
                    <span className={styles.metricValue}>{model.framework}</span>
                    <span className={styles.metricLabel}>Framework</span>
                  </div>
                </div>

                {model.dataset_name && (
                  <div className={styles.datasetRow}>
                    <Database size={12} /> <span>{model.dataset_name}</span>
                  </div>
                )}

                {model.tags && model.tags.length > 0 && (
                  <div className={styles.tagsRow}>
                    <Tag size={12} className={styles.tagIcon} />
                    {model.tags.slice(0, 3).map((tag: string) => (
                      <span key={tag} className={styles.tag}>{tag}</span>
                    ))}
                    {model.tags.length > 3 && <span className={styles.tag}>+{model.tags.length - 3}</span>}
                  </div>
                )}

                {model.description && (
                  <p className={styles.description}>{model.description}</p>
                )}

                <div className={styles.cardFooter}>
                  <span className={styles.footerLeft}>
                    <Clock size={12} /> {formatRelative(model.created_at)}
                  </span>
                  <div className={styles.cardActions}>
                    <div className={styles.menuWrapper}>
                      <button className={styles.menuBtn} onClick={() => setMenuOpenId(menuOpenId === model.name ? null : model.name)}>
                        <MoreVertical size={16} />
                      </button>
                      {menuOpenId === model.name && (
                        <div className={styles.dropdown}>
                          {(model.status === 'staging' || model.status === 'registered') && (
                            <button className={styles.dropdownItem} onClick={() => handleAction('promote', model.name)}>
                              <ArrowUpCircle size={14} /> Promote to Production
                            </button>
                          )}
                          {model.status !== 'archived' && (
                            <button className={styles.dropdownItem} onClick={() => handleAction('archive', model.name)}>
                              <Archive size={14} /> Archive
                            </button>
                          )}
                          <a className={styles.dropdownItem} href={modelsService.download(model.name)} download>
                            <Download size={14} /> Download
                          </a>
                          <button className={styles.dropdownItemDanger} onClick={() => handleAction('delete', model.name)}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.type === 'delete' ? 'Delete Model' : 'Archive Model'}
          message={confirmAction.type === 'delete'
            ? `Permanently delete "${confirmAction.name}"? This cannot be undone.`
            : `Archive "${confirmAction.name}"? It will be hidden from the active list.`}
          onConfirm={executeConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
