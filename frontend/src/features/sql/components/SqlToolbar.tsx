import { memo, useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Save, Wand2, Sparkles, History, Download, Keyboard, ChevronDown,
  Database, Columns3, Code2, PanelLeft, PanelRight, PanelBottom, Bookmark,
  FileJson, FileText, Table2,
} from 'lucide-react';
import styles from './SqlToolbar.module.css';

interface SqlToolbarProps {
  selectedDataset: string;
  datasets: { name: string; filename?: string }[];
  onDatasetChange: (dataset: string) => void;
  onRun: () => void;
  onSave: () => void;
  onFormat: () => void;
  onExplain: () => void;
  onAiAssistant: () => void;
  onToggleHistory: () => void;
  onToggleSaved: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleBottom: () => void;
  onToggleTemplates: () => void;
  onToggleShortcuts: () => void;
  onExport: (format: string) => void;
  isRunning: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  bottomOpen: boolean;
}

export const SqlToolbar = memo(function SqlToolbar({
  selectedDataset, datasets, onDatasetChange, onRun, onSave, onFormat,
  onExplain, onAiAssistant, onToggleHistory, onToggleSaved, onToggleLeft, onToggleRight,
  onToggleBottom, onToggleTemplates, onToggleShortcuts, onExport, isRunning, leftOpen, rightOpen, bottomOpen,
}: SqlToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportOpen]);

  return (
    <div className={styles.toolbar}>
      <div className={styles.datasetGroup}>
        <div className={styles.datasetWrapper}>
          <select
            value={selectedDataset}
            onChange={(e) => onDatasetChange(e.target.value)}
            className={styles.datasetSelect}
          >
            <option value="">All datasets</option>
            {(datasets || []).map((d: any) => (
              <option key={d.name || d.filename} value={d.name || d.filename}>
                {d.filename || d.name}
              </option>
            ))}
          </select>
          <Database className={styles.datasetIcon} />
          <ChevronDown className={styles.datasetChevron} />
        </div>
      </div>

      <div className={styles.divider} />

      <button onClick={onSave} className={styles.btn} title="Save Query (Ctrl+S)">
        <Save className={styles.btnIcon} />
      </button>
      <button onClick={onToggleSaved} className={styles.btn} title="Saved Queries">
        <Bookmark className={styles.btnIcon} />
      </button>
      <button onClick={onToggleTemplates} className={styles.btn} title="Templates">
        <Code2 className={styles.btnIcon} />
      </button>
      <button onClick={onFormat} className={styles.btn} title="Format SQL (Alt+Shift+F)">
        <Wand2 className={styles.btnIcon} />
      </button>
      <button onClick={onExplain} className={styles.btn} title="Explain Query">
        <Columns3 className={styles.btnIcon} />
      </button>
      <button onClick={onAiAssistant} className={`${styles.btn} ${styles.btnAccent}`} title="AI Assistant">
        <Sparkles className={styles.btnIcon} />
      </button>

      <div className={styles.spacer} />

      <div className={styles.datasetGroup}>
        <button onClick={onToggleHistory} className={styles.btn} title="History">
          <History className={styles.btnIcon} />
        </button>
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className={`${styles.btn} ${exportOpen ? styles.btnActive : ''}`}
            title="Export"
          >
            <Download className={styles.btnIcon} />
          </button>
          {exportOpen && (
            <div className={styles.exportDropdown}>
              <button onClick={() => { onExport('csv'); setExportOpen(false); }} className={styles.exportItem}>
                <Table2 className={styles.exportIcon} /> Export CSV
              </button>
              <button onClick={() => { onExport('excel'); setExportOpen(false); }} className={styles.exportItem}>
                <Table2 className={styles.exportIcon} /> Export Excel
              </button>
              <button onClick={() => { onExport('json'); setExportOpen(false); }} className={styles.exportItem}>
                <FileJson className={styles.exportIcon} /> Export JSON
              </button>
              <button onClick={() => { onExport('sql'); setExportOpen(false); }} className={styles.exportItem}>
                <FileText className={styles.exportIcon} /> Export SQL
              </button>
              <button onClick={() => { onExport('clipboard'); setExportOpen(false); }} className={styles.exportItem}>
                <Download className={styles.exportIcon} /> Copy to Clipboard
              </button>
            </div>
          )}
        </div>
        <button onClick={onToggleShortcuts} className={`${styles.btn} hidden sm:flex`} title="Shortcuts">
          <Keyboard className={styles.btnIcon} />
        </button>

        <div className={styles.divider} />

        <button onClick={onToggleLeft} className={`${styles.btn} ${!leftOpen ? styles.panelToggleInactive : ''}`} title="Toggle Schema">
          <PanelLeft className={styles.btnIcon} />
        </button>
        <button onClick={onToggleRight} className={`${styles.btn} ${!rightOpen ? styles.panelToggleInactive : ''}`} title="Toggle AI Assistant">
          <PanelRight className={styles.btnIcon} />
        </button>
        <button onClick={onToggleBottom} className={`${styles.btn} ${!bottomOpen ? styles.panelToggleInactive : ''}`} title="Toggle Results">
          <PanelBottom className={styles.btnIcon} />
        </button>

        <div className={styles.divider} />

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={onRun}
          disabled={isRunning}
          className={styles.runBtn}
        >
          {isRunning ? (
            <div className={styles.runSpinner} />
          ) : (
            <Play className={styles.runBtnIcon} />
          )}
          <span>{isRunning ? 'Running...' : 'Run'}</span>
        </motion.button>
      </div>
    </div>
  );
});
