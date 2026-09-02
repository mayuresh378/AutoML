import { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Database, Table2, Columns3, ChevronRight, ChevronDown, Eye, Loader2, X, Key, Link } from 'lucide-react';
import styles from './SchemaExplorer.module.css';
import { sqlService } from '../services/sqlEditor.service';
import { TablePreviewResult } from '../types';

interface ColumnSchema { name: string; type: string; }
interface TableSchema { name: string; columns: ColumnSchema[]; }

interface SchemaExplorerProps {
  datasets: { name: string }[];
  onTableClick: (tableName: string) => void;
  onColumnClick: (columnName: string) => void;
  editorRef?: any;
  className?: string;
}

function isLikelyPK(colName: string): boolean {
  const lower = colName.toLowerCase();
  return lower === 'id' || lower.endsWith('_id') && lower.split('_id').length === 2 && lower.split('_id')[0].length <= 3;
}

export const SchemaExplorer = memo(function SchemaExplorer({ datasets, onTableClick, onColumnClick }: SchemaExplorerProps) {
  const [search, setSearch] = useState('');
  const [expandedDatasets, setExpandedDatasets] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<TablePreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const inferredSchema = datasets.map((d: any) => ({
    name: (d.name || '').replace(/\.\w+$/, ''),
    tables: [{
      name: (d.name || d.filename || '').replace(/\.\w+$/, ''),
      columns: (d.columns || []).map((c: string) => ({
        name: c,
        type: d.dtypes?.[c] || 'unknown',
      })),
    }],
  }));

  const filtered = inferredSchema.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.tables.some((t) => t.name.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleDataset = (name: string) => setExpandedDatasets((prev) => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const toggleTable = (name: string) => setExpandedTables((prev) => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const handlePreview = useCallback(async (tableName: string) => {
    setPreviewLoading(tableName);
    setShowPreview(true);
    try {
      const data = await sqlService.previewTable(tableName, 20);
      setPreviewData(data);
    } catch {
      setPreviewData(null);
    } finally {
      setPreviewLoading(null);
    }
  }, []);

  return (
    <div className={styles.explorer}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Database className={styles.headerIcon} />
          <span className={styles.headerText}>Schema Explorer</span>
        </div>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search schema..."
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.tree}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>No datasets found</div>
        ) : (
          filtered.map((schema) => (
            <div key={schema.name}>
              <button
                onClick={() => toggleDataset(schema.name)}
                className={styles.datasetNode}
              >
                {expandedDatasets.has(schema.name) ? <ChevronDown className={styles.datasetChevron} /> : <ChevronRight className={styles.datasetChevron} />}
                <Database className={styles.datasetIcon} />
                <span className={styles.datasetName}>{schema.name}</span>
              </button>
              <AnimatePresence>
                {expandedDatasets.has(schema.name) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    {schema.tables.map((table) => (
                      <div key={table.name}>
                        <button
                          onClick={() => { toggleTable(table.name); onTableClick(table.name); }}
                          className={styles.tableNode}
                        >
                          {expandedTables.has(table.name) ? <ChevronDown className={styles.tableChevron} /> : <ChevronRight className={styles.tableChevron} />}
                          <Table2 className={styles.tableIcon} />
                          <span className={styles.tableName}>{table.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePreview(table.name); }}
                            className={styles.previewBtn}
                            title="Preview first 20 rows"
                          >
                            <Eye className={styles.previewIcon} />
                          </button>
                        </button>
                        <AnimatePresence>
                          {expandedTables.has(table.name) && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                              <button
                                onClick={() => onColumnClick('*')}
                                className={`${styles.columnNode} ${styles.allColumns}`}
                              >
                                <Columns3 className={styles.columnIcon} />
                                * (all columns)
                              </button>
                              {(table.columns.length > 0 ? table.columns : []).map((col: ColumnSchema) => (
                                <button
                                  key={col.name}
                                  onClick={() => onColumnClick(col.name)}
                                  className={styles.columnNode}
                                >
                                  {isLikelyPK(col.name) ? (
                                    <Key className={`${styles.columnIcon} ${styles.pkIcon}`} />
                                  ) : (
                                    <Columns3 className={styles.columnIcon} />
                                  )}
                                  <span className={styles.columnName}>{col.name}</span>
                                  <span className={styles.columnType}>{col.type}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      {showPreview && (
        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <Eye className={styles.previewHeaderIcon} />
            <span className={styles.previewTitle}>
              {previewLoading ? 'Loading...' : `Preview: ${previewData?.dataset || ''}`}
            </span>
            <button onClick={() => { setShowPreview(false); setPreviewData(null); }} className={styles.previewClose}>
              <X className={styles.previewCloseIcon} />
            </button>
          </div>
          {previewLoading && (
            <div className={styles.previewLoading}>
              <Loader2 className={styles.previewSpinner} />
            </div>
          )}
          {previewData && !previewLoading && (
            <div className={styles.previewTableWrapper}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    {previewData.columns.map((col) => (
                      <th key={col} className={styles.previewTh}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.data.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : styles.previewRowOdd}>
                      {previewData.columns.map((col) => (
                        <td key={col} className={styles.previewTd}>
                          {row[col] != null ? String(row[col]) : <span className={styles.previewNull}>NULL</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
