import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { TiltCard, MagneticButton } from '../../../components/motion';
import Card from '../../../components/ui/Card';
import { useDatasets } from '../../../hooks/useApi';
import { datasetsService } from '../../../services/datasets.service';
import styles from './DatasetsPage.module.css';

type FilterStatus = 'all' | 'uploaded' | 'processing' | 'ready' | 'error';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const formatNumber = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

const formatFileSize = (sizeKb: number) =>
  sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb.toFixed(1)} KB`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const statusClass: Record<string, string> = {
  uploaded: styles.statusPending,
  processing: styles.statusPending,
  ready: styles.statusProcessed,
  error: styles.statusFailed,
};

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

const sourceIcons: Record<string, string> = { upload: '📁', url: '🔗', database: '🗄️' };

export default function DatasetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importUrlOpen, setImportUrlOpen] = useState(false);
  const [importDbOpen, setImportDbOpen] = useState(false);

  const { data: rawDatasets, isLoading, isError } = useDatasets();

  const datasets = useMemo(() => {
    if (!rawDatasets) return [];
    return rawDatasets.filter((d) => {
      const query = search.toLowerCase();
      const matchesSearch = !query || d.filename?.toLowerCase().includes(query) || d.name?.toLowerCase().includes(query);
      const matchesFilter = filter === 'all' || d.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [rawDatasets, search, filter]);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      await datasetsService.upload(file);
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [queryClient]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleUpload(file);
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this dataset?')) return;
    try {
      await datasetsService.remove(name);
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const statusFilters: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'ready', label: 'Ready' },
    { key: 'processing', label: 'Processing' },
    { key: 'uploaded', label: 'Uploaded' },
    { key: 'error', label: 'Error' },
  ];

  return (
    <div className={styles.page}>
      <input ref={fileInputRef} type="file" hidden accept=".csv,.tsv,.json,.xlsx,.xls,.parquet" onChange={handleFileChange} />

      <motion.div className={styles.header} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div>
          <h1 className={styles.title}>Datasets</h1>
          <p className={styles.subtitle}>Manage and explore your data sources</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.importBtn} onClick={() => setImportUrlOpen(true)}>🔗 Import URL</button>
          <button className={styles.importBtn} onClick={() => setImportDbOpen(true)}>🗄️ Import DB</button>
          <MagneticButton className={styles.uploadButton} onClick={() => fileInputRef.current?.click()} strength={0.2}>
            <span className={styles.uploadIcon}>+</span>
            {uploading ? 'Uploading...' : 'Upload Dataset'}
          </MagneticButton>
        </div>
      </motion.div>

      <motion.div className={styles.toolbar} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input className={styles.searchInput} type="text" placeholder="Search datasets..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className={styles.filterGroup}>
          {statusFilters.map((f) => (
            <button key={f.key} className={filter === f.key ? styles.filterButtonActive : styles.filterButton} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <span className={styles.resultCount}>{datasets.length} dataset{datasets.length !== 1 && 's'}</span>
      </motion.div>

      {isLoading && (
        <motion.div className={styles.emptyState} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className={styles.emptyIcon}>⏳</div>
          <h3 className={styles.emptyTitle}>Loading datasets...</h3>
        </motion.div>
      )}

      {isError && (
        <motion.div className={styles.emptyState} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h3 className={styles.emptyTitle}>Failed to load datasets</h3>
          <p className={styles.emptyDescription}>Something went wrong while fetching your datasets.</p>
          <button className={styles.emptyAction} onClick={() => queryClient.invalidateQueries({ queryKey: ['datasets'] })}>Retry</button>
        </motion.div>
      )}

      {!isLoading && !isError && (
        datasets.length === 0 ? (
          <motion.div
            className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className={styles.emptyIcon}>{dragOver ? '📥' : '📂'}</div>
            <h3 className={styles.emptyTitle}>{dragOver ? 'Drop file here' : 'No datasets found'}</h3>
            <p className={styles.emptyDescription}>
              {dragOver ? 'Release to upload your file' : 'Drag and drop a file here, or click Upload to get started.'}
            </p>
            {!dragOver && (
              <button className={styles.emptyAction} onClick={() => fileInputRef.current?.click()}>Upload Dataset</button>
            )}
          </motion.div>
        ) : (
          <div
            className={`${styles.gridWrapper} ${dragOver ? styles.gridWrapperActive : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {dragOver && (
              <div className={styles.dropOverlay}>
                <div className={styles.dropOverlayText}>📥 Drop file here to upload</div>
              </div>
            )}
            <Reorder.Group axis="y" values={datasets} onReorder={() => {}} className={styles.grid}>
              {datasets.map((dataset) => (
                <Reorder.Item
                  key={dataset.id || dataset.name}
                  value={dataset}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  whileDrag={{ scale: 1.03, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', zIndex: 10 }}
                  style={{ listStyle: 'none' }}
                >
                  <TiltCard glareColor="rgba(79,70,229,0.08)" maxTilt={4} scale={1.01}>
                    <div className={styles.datasetCard} onClick={() => navigate(`/datasets/${dataset.id || dataset.name}`)}>
                      <Card>
                        <div className={styles.cardTop}>
                          <div className={styles.cardTitleRow}>
                            <span className={styles.name} title={dataset.name || dataset.filename}>
                              {sourceIcons[dataset.source || 'upload']} {dataset.name || dataset.filename}
                            </span>
                            {dataset.version && dataset.version > 1 && (
                              <span className={styles.versionBadge}>v{dataset.version}</span>
                            )}
                          </div>
                          <span className={`${styles.statusBadge} ${statusClass[dataset.status] || ''}`}>
                            <span className={styles.statusDot} />
                            {statusLabel(dataset.status)}
                          </span>
                        </div>

                        {dataset.tags && dataset.tags.length > 0 && (
                          <div className={styles.tagsRow}>
                            {dataset.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className={styles.tag}>{tag}</span>
                            ))}
                            {dataset.tags.length > 3 && <span className={styles.tagMore}>+{dataset.tags.length - 3}</span>}
                          </div>
                        )}

                        <div className={styles.cardStats}>
                          <div className={styles.statItem}>
                            <span className={styles.statValue}>{formatNumber(dataset.rows)}</span>
                            <span className={styles.statLabel}>Rows</span>
                          </div>
                          <div className={styles.statItem}>
                            <span className={styles.statValue}>{formatNumber(dataset.columns?.length || 0)}</span>
                            <span className={styles.statLabel}>Columns</span>
                          </div>
                          <div className={styles.statItem}>
                            <span className={styles.statValue}>{formatFileSize(dataset.size_kb)}</span>
                            <span className={styles.statLabel}>Size</span>
                          </div>
                        </div>

                        <hr className={styles.cardDivider} />

                        <div className={styles.cardFooter}>
                          <span className={styles.createdAt}>{formatDate(dataset.created_at)}</span>
                          <div className={styles.cardActions}>
                            <button className={styles.viewAction} onClick={(e) => { e.stopPropagation(); navigate(`/datasets/${dataset.id || dataset.name}`); }}>
                              View →
                            </button>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </TiltCard>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>
        )
      )}

      <AnimatePresence>
        {importUrlOpen && <ImportUrlDialog onClose={() => setImportUrlOpen(false)} queryClient={queryClient} />}
        {importDbOpen && <ImportDbDialog onClose={() => setImportDbOpen(false)} queryClient={queryClient} />}
      </AnimatePresence>
    </div>
  );
}

function ImportUrlDialog({ onClose, queryClient }: { onClose: () => void; queryClient: any }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      await datasetsService.importFromUrl(url, name || undefined);
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className={styles.dialogOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className={styles.dialog} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.dialogTitle}>🔗 Import from URL</h3>
        <p className={styles.dialogDesc}>Enter a URL to download a CSV, Excel, JSON, or Parquet file.</p>
        <input className={styles.dialogInput} placeholder="https://example.com/data.csv" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className={styles.dialogInput} placeholder="Dataset name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <p className={styles.dialogError}>{error}</p>}
        <div className={styles.dialogActions}>
          <button className={styles.dialogCancel} onClick={onClose}>Cancel</button>
          <button className={styles.dialogConfirm} onClick={handleSubmit} disabled={loading || !url.trim()}>
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ImportDbDialog({ onClose, queryClient }: { onClose: () => void; queryClient: any }) {
  const [connStr, setConnStr] = useState('');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!connStr.trim() || !query.trim()) return;
    setLoading(true);
    setError('');
    try {
      await datasetsService.importFromDatabase(connStr, query, name || undefined);
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className={styles.dialogOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className={styles.dialog} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.dialogTitle}>🗄️ Import from Database</h3>
        <p className={styles.dialogDesc}>Connect to a PostgreSQL, MySQL, or SQLite database and import a table.</p>
        <input className={styles.dialogInput} placeholder="postgresql://user:pass@host:5432/dbname" value={connStr} onChange={(e) => setConnStr(e.target.value)} />
        <textarea className={styles.dialogTextarea} placeholder="SELECT * FROM my_table LIMIT 1000" value={query} onChange={(e) => setQuery(e.target.value)} rows={3} />
        <input className={styles.dialogInput} placeholder="Dataset name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <p className={styles.dialogError}>{error}</p>}
        <div className={styles.dialogActions}>
          <button className={styles.dialogCancel} onClick={onClose}>Cancel</button>
          <button className={styles.dialogConfirm} onClick={handleSubmit} disabled={loading || !connStr.trim() || !query.trim()}>
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
