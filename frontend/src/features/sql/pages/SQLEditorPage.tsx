import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, X, Plus, AlertCircle, Loader2, FileText, History,
  BarChart3, Table2, Sparkles, Activity, Rocket, ShieldAlert, Clock, Ban,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import styles from './SQLEditorPage.module.css';
import { datasetsService } from '../../../services/datasets.service';
import { useNotification } from '../../../hooks/useNotification';
import { useTheme } from '../../../hooks/useTheme';
import { useSqlEditorStore } from '../store/useSqlEditorStore';
import { sqlService } from '../services/sqlEditor.service';
import { SchemaExplorer } from '../components/SchemaExplorer';
import { SqlToolbar } from '../components/SqlToolbar';
import { SqlEditor } from '../components/SqlEditor';
import { AiAssistant } from '../components/AiAssistant';
import { ResultsGrid } from '../components/ResultsGrid';
import { QueryHistory } from '../components/QueryHistory';
import { SavedQueriesPanel } from '../components/SavedQueriesPanel';
import { DataProfile } from '../components/DataProfile';
import { ExplainTab } from '../components/ExplainTab';
import { AiRecommendations } from '../components/AiRecommendations';
import { QUERY_TEMPLATES, KEYBOARD_SHORTCUTS, QueryResult, QueryProfile } from '../types';
import {
  BarChart, PieChart as RePie, LineChart as ReLine, AreaChart, ScatterChart,
  Bar, Pie, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';

const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6', '#f97316'];

export default function SQLEditorPage() {
  const { notifyError, notifySuccess } = useNotification();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDataset, setSelectedDataset] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [chartConfig, setChartConfig] = useState<{ type: string; xKey: string; yKey: string } | null>(null);
  const [queryTemplates] = useState(QUERY_TEMPLATES);
  const [profile, setProfile] = useState<QueryProfile | null>(null);
  const [savingDataset, setSavingDataset] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<{ query: string; operations?: string[]; message?: string } | null>(null);
  const [confirmingDestructive, setConfirmingDestructive] = useState(false);
  const [nextPageLoading, setNextPageLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const resizerRef = useRef<{ startX?: number; startY?: number; panel?: string }>({});

  const {
    tabs, activeTabId, leftPanelOpen, rightPanelOpen, resultsPanelOpen, resultsPanelTab,
    leftPanelWidth, rightPanelWidth, resultsPanelHeight,
    addTab, closeTab, setActiveTab, updateTabQuery, updateTabResult, updateTabError, updateTabRunning,
    updateTabRunningInfo, renameTab, duplicateTab,
    toggleLeftPanel, toggleRightPanel, toggleResultsPanel, setResultsPanelOpen, setResultsPanelTab,
    setLeftPanelWidth, setRightPanelWidth, setResultsPanelHeight,
  } = useSqlEditorStore(useShallow((s) => ({
    tabs: s.tabs, activeTabId: s.activeTabId, leftPanelOpen: s.leftPanelOpen,
    rightPanelOpen: s.rightPanelOpen, resultsPanelOpen: s.resultsPanelOpen,
    resultsPanelTab: s.resultsPanelTab, leftPanelWidth: s.leftPanelWidth,
    rightPanelWidth: s.rightPanelWidth, resultsPanelHeight: s.resultsPanelHeight,
    addTab: s.addTab, closeTab: s.closeTab, setActiveTab: s.setActiveTab,
    updateTabQuery: s.updateTabQuery, updateTabResult: s.updateTabResult,
    updateTabError: s.updateTabError, updateTabRunning: s.updateTabRunning,
    updateTabRunningInfo: s.updateTabRunningInfo,
    renameTab: s.renameTab, duplicateTab: s.duplicateTab,
    toggleLeftPanel: s.toggleLeftPanel, toggleRightPanel: s.toggleRightPanel,
    toggleResultsPanel: s.toggleResultsPanel, setResultsPanelOpen: s.setResultsPanelOpen,
    setResultsPanelTab: s.setResultsPanelTab,
    setLeftPanelWidth: s.setLeftPanelWidth, setRightPanelWidth: s.setRightPanelWidth,
    setResultsPanelHeight: s.setResultsPanelHeight,
  })));

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const { data: datasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
    select: (d: any) => d.datasets,
  });

  useEffect(() => {
    if (selectedDataset || !datasets?.length) return;
    const param = new URLSearchParams(location.search).get('dataset');
    if (!param) return;
    const found = (datasets as any[]).find(
      (d) => d.name === param || d.filename === param,
    );
    setSelectedDataset(found ? (found.name || found.filename) : param);
  }, [datasets, selectedDataset, location.search]);

  const schemaColumns = useMemo(() => {
    const ds = (datasets || []).find((d: any) => d.name === selectedDataset || d.filename === selectedDataset) || (datasets as any)?.[0];
    const cols: string[] = ds?.columns || [];
    return cols.filter((c) => c.toLowerCase() !== 'id');
  }, [datasets, selectedDataset]);

  const schemaTableNames = useMemo(() => {
    return (datasets || []).map((d: any) => d.name?.replace(/\.\w+$/, '') || d.filename?.replace(/\.\w+$/, '') || 'data');
  }, [datasets]);

  const defaultTableName = useMemo(() => {
    if (selectedDataset) return 'data';
    if (datasets?.length) {
      const f = datasets[0].name || datasets[0].filename;
      return f ? f.replace(/\.\w+$/, '') : 'data';
    }
    return 'data';
  }, [selectedDataset, datasets]);

  const resolveTable = useCallback((query: string) => {
    const cols = schemaColumns;
    const firstCol = cols[0] || 'col';
    const numericCol = cols.find((c) => {
      const ds = (datasets || []).find((d: any) => d.name === selectedDataset || d.filename === selectedDataset);
      const dtypes = ds?.dtypes || (datasets?.[0] as any)?.dtypes || {};
      const t = (dtypes[c] || '').toLowerCase();
      return t.includes('int') || t.includes('float') || t.includes('double');
    }) || cols[cols.length - 1] || firstCol;
    return query
      .replace(/\btable_a\b/g, defaultTableName)
      .replace(/\btable_b\b/g, datasets?.[1]?.name?.replace(/\.\w+$/, '') || 'table_b')
      .replace(/\bdata\b/g, defaultTableName)
      .replace(/\bcolumn_name\b/g, firstCol)
      .replace(/\bvalue\b/g, numericCol);
  }, [defaultTableName, datasets, selectedDataset, schemaColumns]);

  const handleRun = useCallback(async (queryOverride?: string, confirm = false, datasetOverride?: string) => {
    const ds = datasetOverride ?? selectedDataset;
    const rawVal = queryOverride ?? activeTab?.query;
    const raw = typeof rawVal === 'string' ? rawVal : '';
    if (!raw.trim()) {
      notifyError('Enter a SQL query to run.', 'Type a SQL query in the editor, then click Run.');
      return;
    }
    const resolvedQuery = resolveTable(raw.trim());
    updateTabRunning(activeTabId, true);
    updateTabResult(activeTabId, null);
    updateTabError(activeTabId, null);
    const clientId = crypto.randomUUID();
    updateTabRunningInfo(activeTabId, { clientId, startedAt: Date.now(), operation: 'run' });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await sqlService.executeQuery(resolvedQuery, ds, {
        clientId,
        signal: controller.signal,
        pageSize: 500,
        confirmDestructive: confirm,
      });
      if (data.status === 'requires_confirmation') {
        setPendingConfirm({ query: resolvedQuery, operations: data.operations || [], message: data.message });
        notifyError('Confirmation required', 'This query performs destructive operations. Confirm to continue.');
        return;
      }
      if (data.status === 'cancelled' || data.status === 'timeout') {
        updateTabError(activeTabId, data.message || `Query ${data.status}`);
        notifyError('Query ' + data.status, data.message || '');
        return;
      }
      updateTabResult(activeTabId, data);
      setResultsPanelOpen(true);
      setResultsPanelTab('results');
      notifySuccess('Query completed', `${data.total_rows ?? data.rows} row(s) returned in ${data.execution_time_ms ?? data.executionTime}ms`);
    } catch (err: any) {
      const aborted = err?.name === 'AbortError' || err?.code === 'ABORTED' || err?.code === 'TIMEOUT';
      const networkError = err instanceof TypeError;
      const msg = networkError
        ? 'Backend connection failed.'
        : aborted
          ? (err?.code === 'ABORTED' ? 'Query cancelled' : 'Query timed out after 75s')
          : err.message || String(err);
      updateTabError(activeTabId, msg);
      if (!aborted || err?.code !== 'ABORTED') {
        notifyError(networkError ? 'Backend connection failed' : aborted ? 'Query timed out' : 'Query failed', msg);
      }
    } finally {
      abortRef.current = null;
      updateTabRunningInfo(activeTabId, null);
      updateTabRunning(activeTabId, false);
    }
  }, [activeTab, activeTabId, selectedDataset, resolveTable, updateTabRunning, updateTabRunningInfo, updateTabResult, updateTabError, notifySuccess, notifyError]);

  const handleCancel = useCallback(() => {
    const info = activeTab?.runningInfo;
    if (info?.clientId) {
      sqlService.cancelQueryByClient(info.clientId).catch(() => {});
    }
    abortRef.current?.abort();
  }, [activeTab]);

  const handleConfirmDestructive = useCallback(async () => {
    if (!pendingConfirm) return;
    setConfirmingDestructive(true);
    try {
      await handleRun(pendingConfirm.query, true, selectedDataset);
      setPendingConfirm(null);
    } catch (err: any) {
      notifyError('Query failed', err.message || String(err));
    } finally {
      setConfirmingDestructive(false);
    }
  }, [pendingConfirm, handleRun, selectedDataset, notifyError]);

  const loadMoreResults = useCallback(async () => {
    const r = activeTab?.result;
    if (!r?.query_id || nextPageLoading) return;
    const loaded = r.data.length;
    if (r.total_rows != null && loaded >= r.total_rows) return;
    const pageSize = 500;
    const nextPage = Math.floor(loaded / pageSize) + 1;
    setNextPageLoading(true);
    try {
      const chunk = await sqlService.fetchResultPage(r.query_id, nextPage, pageSize);
      const merged: QueryResult = {
        ...chunk,
        query: r.query,
        executionTime: r.executionTime,
        execution_time_ms: r.execution_time_ms,
        dataset_name: r.dataset_name,
      };
      const combinedRows = [...r.data, ...chunk.data];
      merged.data = combinedRows;
      merged.rows = combinedRows.length;
      merged.page = chunk.page;
      merged.total_rows = r.total_rows;
      updateTabResult(activeTabId, merged);
    } catch (err: any) {
      notifyError('Failed to load more', err.message || String(err));
    } finally {
      setNextPageLoading(false);
    }
  }, [activeTab, activeTabId, nextPageLoading, updateTabResult, notifyError]);

  const handleFormat = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!(typeof activeTab?.query === 'string' && activeTab.query.trim())) {
      notifyError('Save failed', 'No query to save');
      return;
    }
    setSaveName(activeTab.name.replace(/\.sql$/, ''));
    setSaveDialogOpen(true);
  }, [activeTab, notifyError]);

  const handleSaveConfirm = useCallback(async () => {
    if (!saveName.trim() || !(typeof activeTab?.query === 'string' && activeTab.query.trim())) return;
    try {
      await sqlService.saveQuery({
        name: saveName.trim(),
        query: activeTab.query,
        dataset: selectedDataset,
        folder: 'default',
        tags: [],
        pinned: false,
      });
      setSaveDialogOpen(false);
      setSaveName('');
      notifySuccess('Query Saved', `"${saveName.trim()}" saved successfully`);
    } catch (err: any) {
      notifyError('Save failed', err.message || String(err));
    }
  }, [saveName, activeTab, selectedDataset, notifySuccess, notifyError]);

  const handleMonacoMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.addAction({
      id: 'run-query-action',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => handleRun(),
    });

    editor.addAction({
      id: 'save-query-action',
      label: 'Save Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => handleSave(),
    });

    editor.addAction({
      id: 'toggle-comment-action',
      label: 'Toggle Comment',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
      run: () => {
        editor.trigger('keyboard', 'editor.action.commentLine');
      },
    });

    editor.addAction({
      id: 'format-sql-action',
      label: 'Format SQL',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: () => handleFormat(),
    });
  }, [handleRun, handleSave, handleFormat]);

  const handleInsertQuery = useCallback((text: string) => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      const range = new monacoRef.current.Range(
        selection.startLineNumber, selection.startColumn,
        selection.endLineNumber, selection.endColumn,
      );
      editorRef.current.executeEdits('insert', [{ range, text }]);
    } else {
      updateTabQuery(activeTabId, (activeTab?.query || '') + text);
    }
  }, [activeTabId, activeTab]);

  const handleTableClick = useCallback((tableName: string) => {
    const name = selectedDataset ? 'data' : tableName;
    handleInsertQuery(`SELECT *\nFROM ${name}\nLIMIT 100;`);
  }, [handleInsertQuery, selectedDataset]);

  const handleColumnClick = useCallback((columnName: string) => {
    if (columnName === '*') {
      handleInsertQuery('*');
    } else {
      handleInsertQuery(columnName);
    }
  }, [handleInsertQuery]);

  const handleRestoreQuery = useCallback((query: string) => {
    updateTabQuery(activeTabId, query);
    setShowHistory(false);
    setShowSaved(false);
  }, [activeTabId, updateTabQuery]);

  const handleAiAssistantToggle = useCallback(() => {
    toggleRightPanel();
  }, [toggleRightPanel]);

  const handleExport = useCallback((format: string) => {
    const rs = activeTab?.result ?? null;
    const query = typeof activeTab?.query === 'string' ? activeTab.query : '';
    const ts = Date.now();
    if (format === 'csv' || format === 'json') {
      if (!query?.trim()) {
        notifyError('Export failed', 'No query to export. Run a query first.');
        return;
      }
      if (format === 'csv') sqlService.exportServerCSV(query.trim(), selectedDataset, `query_${ts}.csv`);
      else sqlService.exportServerJSON(query.trim(), selectedDataset, `query_${ts}.json`);
      notifySuccess('Export started', `Full query result streaming as ${format.toUpperCase()}`);
      return;
    }
    if (format === 'sql' || format === 'clipboard') {
      if (format === 'sql') sqlService.exportSQL(query, `query_${ts}`);
      else { sqlService.copyToClipboard(query); notifySuccess('Copied', 'Query copied to clipboard'); }
      return;
    }
    if (!rs?.data?.length) {
      notifyError('Export failed', 'No results to export. Run a query first.');
      return;
    }
    if (format === 'csv') sqlService.exportCSV(rs.data, `query_${ts}`);
    else if (format === 'excel') sqlService.exportExcel(rs.data, `query_${ts}`);
    else if (format === 'json') sqlService.exportJSON(rs.data, `query_${ts}`);
  }, [activeTab, selectedDataset, notifySuccess, notifyError]);

  const handleSaveAsDataset = useCallback(async () => {
    if (!(typeof activeTab?.query === 'string' && activeTab.query.trim())) return;
    setSavingDataset(true);
    try {
      const result = await sqlService.resultToDataset(activeTab.query.trim(), selectedDataset);
      notifySuccess('Dataset Created', `"${result.dataset}" saved with ${result.rows} rows`);
      setTimeout(() => navigate(`/app/training?dataset=${encodeURIComponent(result.dataset)}`), 800);
    } catch (err: any) {
      notifyError('Save Failed', err.message || String(err));
    } finally {
      setSavingDataset(false);
    }
  }, [activeTab, selectedDataset, notifySuccess, notifyError, navigate]);

  const handleResizeStart = useCallback((e: React.MouseEvent, panel: string) => {
    e.preventDefault();
    resizerRef.current = { startX: e.clientX, startY: e.clientY, panel };
    const handler = (ev: MouseEvent) => {
      if (!resizerRef.current) return;
      const deltaX = ev.clientX - (resizerRef.current.startX || 0);
      if (resizerRef.current.panel === 'left') {
        setLeftPanelWidth(Math.max(200, Math.min(500, leftPanelWidth + deltaX)));
      } else if (resizerRef.current.panel === 'right') {
        setRightPanelWidth(Math.max(250, Math.min(500, rightPanelWidth - deltaX)));
      } else if (resizerRef.current.panel === 'results') {
        const deltaY = ev.clientY - (resizerRef.current.startY || 0);
        setResultsPanelHeight(Math.max(160, Math.min(650, resultsPanelHeight - deltaY)));
      }
      resizerRef.current.startX = ev.clientX;
      resizerRef.current.startY = ev.clientY;
    };
    const upHandler = () => {
      resizerRef.current = {};
      document.removeEventListener('mousemove', handler);
      document.removeEventListener('mouseup', upHandler);
    };
    document.addEventListener('mousemove', handler);
    document.addEventListener('mouseup', upHandler);
  }, [leftPanelWidth, rightPanelWidth, resultsPanelHeight, setLeftPanelWidth, setRightPanelWidth, setResultsPanelHeight]);

  const resultsTabs = [
    { id: 'results', label: 'Results', icon: Table2 },
    { id: 'profiling', label: 'Statistics', icon: BarChart3 },
    { id: 'charts', label: 'Charts', icon: BarChart3 },
    { id: 'aiRecs', label: 'AI Recs', icon: Sparkles },
    { id: 'explain', label: 'Explain', icon: Activity },
    { id: 'history', label: 'History', icon: History },
  ];

  const result = activeTab?.result;

  return (
    <div className={styles.page}>
      <SqlToolbar
        selectedDataset={selectedDataset}
        datasets={datasets || []}
        onDatasetChange={setSelectedDataset}
        onRun={handleRun}
        onSave={handleSave}
        onFormat={handleFormat}
        onExplain={() => { setResultsPanelOpen(true); setResultsPanelTab('explain'); }}
        onAiAssistant={handleAiAssistantToggle}
        onToggleHistory={() => setShowHistory(true)}
        onToggleSaved={() => setShowSaved(true)}
        onToggleLeft={toggleLeftPanel}
        onToggleRight={toggleRightPanel}
        onToggleResults={toggleResultsPanel}
        onToggleTemplates={() => setShowTemplates(!showTemplates)}
        onToggleShortcuts={() => setShowShortcuts(true)}
        onExport={handleExport}
        isRunning={activeTab?.isRunning || false}
        leftOpen={leftPanelOpen}
        rightOpen={rightPanelOpen}
        resultsOpen={resultsPanelOpen}
      />

      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={styles.templatesDropdown}
          >
            <div className={styles.templatesList}>
              {queryTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => { handleInsertQuery(resolveTable(tpl.query)); setShowTemplates(false); }}
                  className={styles.templateCard}
                >
                  <div className={styles.templateName}>{tpl.name}</div>
                  <div className={styles.templateDesc}>{tpl.description}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.tabBar}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
          >
            <FileText className={styles.tabIcon} />
            <span className={styles.tabName}>{tab.name}{tab.isDirty ? ' *' : ''}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className={styles.tabClose}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button onClick={addTab} className={styles.addTab}>
          <Plus className={styles.tabIcon} />
        </button>
      </div>

      <div className={styles.mainContent}>
        <AnimatePresence>
          {leftPanelOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: leftPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className={styles.leftPanel}
            >
              <div style={{ width: leftPanelWidth }} className="h-full">
                <SchemaExplorer
                  datasets={datasets || []}
                  onTableClick={handleTableClick}
                  onColumnClick={handleColumnClick}
                  editorRef={editorRef}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {leftPanelOpen && (
          <div className={styles.resizerVertical} onMouseDown={(e) => handleResizeStart(e, 'left')} />
        )}

        <div className={styles.centerColumn}>
          <div className={styles.editorArea}>
            <SqlEditor
              value={activeTab?.query || ''}
              onChange={(val) => updateTabQuery(activeTabId, val)}
              onMount={handleMonacoMount}
              isDark={isDark}
              columns={schemaColumns}
              tableNames={schemaTableNames}
            />
          </div>

          {activeTab?.error && (
            <div className={styles.errorBar}>
              <AlertCircle className={styles.errorIcon} />
              <div className={styles.errorText}>{activeTab.error}</div>
              <button onClick={() => updateTabError(activeTabId, null)} className={styles.errorClose}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab?.isRunning && (
            <RunningBar startedAt={activeTab.runningInfo?.startedAt} onCancel={handleCancel} />
          )}
        </div>

        {rightPanelOpen && (
          <div className={styles.resizerVertical} onMouseDown={(e) => handleResizeStart(e, 'right')} />
        )}
        <AnimatePresence>
          {rightPanelOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: rightPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className={styles.rightPanel}
            >
              <div style={{ width: rightPanelWidth }} className="h-full">
                <AiAssistant
                  onInsertQuery={(q) => handleInsertQuery(resolveTable(q))}
                  currentQuery={activeTab?.query}
                  dataset={selectedDataset}
                  columns={schemaColumns}
                  dtypes={(() => {
                    const ds = (datasets || []).find((d: any) => d.name === selectedDataset || d.filename === selectedDataset) || (datasets as any)?.[0];
                    return ds?.dtypes || {};
                  })()}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {resultsPanelOpen && (
        <div className={styles.resultsSection} style={{ height: resultsPanelHeight }}>
          <div className={styles.resultsResizer} onMouseDown={(e) => handleResizeStart(e, 'results')} />
          <div className={styles.resultsPanel}>
            <div className={styles.resultsTabs}>
              {resultsTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setResultsPanelTab(tab.id)}
                    className={`${styles.resultsTab} ${resultsPanelTab === tab.id ? styles.resultsTabActive : ''}`}
                  >
                    <Icon className={styles.resultsTabIcon} />
                    {tab.label}
                  </button>
                );
              })}
              <div className={styles.resultsTabSpacer} />
              <button
                onClick={handleSaveAsDataset}
                disabled={savingDataset || !(typeof activeTab?.query === 'string' && activeTab.query.trim())}
                className={styles.trainBtn}
                title="Save query result as dataset and go to Training"
              >
                {savingDataset ? (
                  <Loader2 className={styles.trainBtnIcon} />
                ) : (
                  <Rocket className={styles.trainBtnIcon} />
                )}
                {savingDataset ? 'Saving...' : 'Use for Training'}
              </button>
              <button onClick={toggleResultsPanel} className={styles.resultsTabClose}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className={styles.resultsTabContent}>
              {resultsPanelTab === 'results' && result && (
                <ResultsGrid
                  result={result}
                  dataset={selectedDataset}
                  onLoadMore={loadMoreResults}
                  loadingMore={nextPageLoading}
                />
              )}
              {resultsPanelTab === 'results' && !result && (
                <div className={styles.emptyState}>No query executed yet. Run a query to see the result here.</div>
              )}
              {resultsPanelTab === 'profiling' && (
                <DataProfile query={activeTab?.query || ''} dataset={selectedDataset} />
              )}
              {resultsPanelTab === 'charts' && result && (
                <ChartView result={result} chartConfig={chartConfig} setChartConfig={setChartConfig} />
              )}
              {resultsPanelTab === 'charts' && !result && (
                <div className={styles.emptyState}>Run a query to visualize data</div>
              )}
              {resultsPanelTab === 'aiRecs' && (
                <AiRecommendations profile={profile} onInsertQuery={(q) => handleInsertQuery(resolveTable(q))} />
              )}
              {resultsPanelTab === 'explain' && (
                <ExplainTab query={activeTab?.query || ''} dataset={selectedDataset} />
              )}
              {resultsPanelTab === 'history' && (
                <QueryHistory onRestoreQuery={handleRestoreQuery} onClose={() => setResultsPanelOpen(false)} />
              )}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showHistory && (
          <QueryHistory onRestoreQuery={handleRestoreQuery} onClose={() => setShowHistory(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSaved && (
          <SavedQueriesPanel onRestoreQuery={handleRestoreQuery} onClose={() => setShowSaved(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShortcuts && (
          <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {saveDialogOpen && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalOverlay} onClick={() => setSaveDialogOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={styles.modalContent}
            >
              <div className={styles.modalHeader}>
                <span className={styles.modalTitle}>Save Query</span>
                <button onClick={() => setSaveDialogOpen(false)} className={styles.modalClose}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div style={{ padding: 16 }}>
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveConfirm(); }}
                  placeholder="Query name..."
                  className={styles.saveInput}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button onClick={() => setSaveDialogOpen(false)} className={styles.saveCancelBtn}>Cancel</button>
                  <button onClick={handleSaveConfirm} disabled={!saveName.trim()} className={styles.saveConfirmBtn}>Save</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    <AnimatePresence>
        {pendingConfirm && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalOverlay} onClick={() => setPendingConfirm(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={styles.modalContent}
            >
              <div className={styles.modalHeader}>
                <span className={styles.modalTitle} style={{ color: '#f59e0b' }}>
                  <ShieldAlert style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} size={18} />
                  Confirm Destructive Query
                </span>
                <button onClick={() => setPendingConfirm(null)} className={styles.modalClose}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div style={{ padding: 16 }}>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'inherit', marginBottom: 12 }}>
                  {pendingConfirm.message}
                </p>
                {(pendingConfirm.operations?.length || 0) > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {pendingConfirm.operations!.map((op) => (
                      <span
                        key={op}
                        style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 12,
                          background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                          border: '1px solid rgba(245,158,11,0.4)',
                        }}
                      >
                        {op}
                      </span>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 14 }}>
                  Running inside the sandbox is ephemeral — changes will not persist unless you save them as a dataset. Then run the query only if you are sure.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setPendingConfirm(null)} className={styles.saveCancelBtn}>Cancel</button>
                  <button
                    onClick={handleConfirmDestructive}
                    disabled={confirmingDestructive}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: '#f59e0b', color: '#1c1917', border: 'none', cursor: 'pointer',
                    }}
                  >
                    {confirmingDestructive && <Loader2 size={14} className={styles.runningSpinner} />}
                    {confirmingDestructive ? 'Running...' : 'Run it anyway'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RunningBar({ startedAt, onCancel }: { startedAt?: number; onCancel: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = startedAt ?? Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(t);
  }, [startedAt]);
  return (
    <div className={styles.runningBar}>
      <div className={styles.runningSpinner} />
      <span className={styles.runningText}>Executing query...</span>
      <span className={styles.runningElapsed}>
        <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        {elapsed}s
      </span>
      <button onClick={onCancel} className={styles.cancelBtn}>
        <Ban size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
        Cancel
      </button>
    </div>
  );
}

function ChartView({
  result, chartConfig, setChartConfig,
}: {
  result: QueryResult; chartConfig: { type: string; xKey: string; yKey: string } | null;
  setChartConfig: (c: { type: string; xKey: string; yKey: string } | null) => void;
}) {
  const columns = result.columns;
  const numCols = columns.filter((c) => result.data.some((r) => typeof r[c] === 'number'));
  const strCols = columns.filter((c) => !numCols.includes(c));
  const xKey = chartConfig?.xKey || strCols[0] || columns[0];
  const yKey = chartConfig?.yKey || numCols[0] || columns[columns.length - 1];
  const chartType = chartConfig?.type || 'bar';

  const data = result.data.slice(0, 100);

  return (
    <div className={styles.chartArea}>
      <div className={styles.chartControls}>
        <select
          value={chartType}
          onChange={(e) => setChartConfig({ type: e.target.value, xKey, yKey })}
          className={styles.chartSelect}
        >
          <option value="bar">Bar</option>
          <option value="pie">Pie</option>
          <option value="line">Line</option>
          <option value="area">Area</option>
          <option value="scatter">Scatter</option>
        </select>
        <select
          value={xKey}
          onChange={(e) => setChartConfig({ type: chartType, xKey: e.target.value, yKey })}
          className={styles.chartSelect}
        >
          {strCols.map((c) => <option key={c} value={c}>{c} (X)</option>)}
          {numCols.map((c) => <option key={c} value={c}>{c} (X)</option>)}
        </select>
        <select
          value={yKey}
          onChange={(e) => setChartConfig({ type: chartType, xKey, yKey: e.target.value })}
          className={styles.chartSelect}
        >
          {numCols.map((c) => <option key={c} value={c}>{c} (Y)</option>)}
        </select>
      </div>
      <div className="flex-1 p-3">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#71717a' }} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
              <Tooltip />
              <Bar dataKey={yKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chartType === 'pie' ? (
            <RePie>
              <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={100} label>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </RePie>
          ) : chartType === 'line' ? (
            <ReLine data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#71717a' }} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
              <Tooltip />
              <Line type="monotone" dataKey={yKey} stroke="#3b82f6" strokeWidth={2} dot={false} />
            </ReLine>
          ) : chartType === 'area' ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#71717a' }} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
              <Tooltip />
              <Area type="monotone" dataKey={yKey} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
            </AreaChart>
          ) : (
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#71717a' }} />
              <YAxis dataKey={yKey} tick={{ fontSize: 10, fill: '#71717a' }} />
              <Tooltip />
              <Scatter data={data} fill="#3b82f6" />
            </ScatterChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalOverlay} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={styles.modalContent}
      >
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Keyboard Shortcuts</span>
          <button onClick={onClose} className={styles.modalClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={styles.modalBody}>
          {KEYBOARD_SHORTCUTS.map((sc) => (
            <div key={sc.key} className={styles.shortcutRow}>
              <span className={styles.shortcutAction}>{sc.action}</span>
              <kbd className={styles.shortcutKey}>
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
