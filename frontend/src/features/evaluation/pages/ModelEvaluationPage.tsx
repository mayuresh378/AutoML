import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, AlertCircle, Layers, Table2, BarChart3, RefreshCw } from 'lucide-react';
import { useModels, useDatasets } from '../../../hooks/useApi';
import { getErrorMessage } from '../../../services/http';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EvaluationSetupPanel, type DatasetSelection } from '../components/EvaluationSetupPanel';
import { MetricGrid } from '../components/MetricGrid';
import { InsightsPanel } from '../components/InsightsPanel';
import { ConfusionMatrixChart } from '../components/ConfusionMatrixChart';
import { RocCurveChart } from '../components/RocCurveChart';
import { PrCurveChart } from '../components/PrCurveChart';
import { FeatureImportanceChart } from '../components/FeatureImportanceChart';
import { LearningCurve } from '../components/LearningCurve';
import { ValidationCurve } from '../components/ValidationCurve';
import { ResidualPlot } from '../components/ResidualPlot';
import { PredictionDistribution } from '../components/PredictionDistribution';
import { PredictionSamplesTable } from '../components/PredictionSamplesTable';
import { PreprocessingSummaryCard } from '../components/PreprocessingSummaryCard';
import { ModelComparisonTable } from '../components/ModelComparisonTable';
import { EvaluationHistoryPanel } from '../components/EvaluationHistoryPanel';
import { ComparisonPanel } from '../components/ComparisonPanel';
import {
  useCompareModels,
  useEvaluationDetail,
  useEvaluationHistory,
  useRunDatasetEvaluation,
} from '../hooks/useEvaluation';
import type { ComprehensiveEvaluation, TaskType } from '../services/evaluation.service';
import styles from './ModelEvaluationPage.module.css';

const EMPTY_SELECTION: DatasetSelection = { fileName: '', targetColumn: '', taskType: 'classification' };
const HISTORY_PAGE = 10;

type TabId = 'overview' | 'curves' | 'diagnostics' | 'predictions' | 'compare';

const TABS: { id: TabId; label: string; icon: typeof Layers }[] = [
  { id: 'overview', label: 'Overview', icon: Layers },
  { id: 'curves', label: 'Curves', icon: BarChart3 },
  { id: 'diagnostics', label: 'Diagnostics', icon: ClipboardCheck },
  { id: 'predictions', label: 'Predictions', icon: Table2 },
  { id: 'compare', label: 'Compare', icon: BarChart3 },
];

export function ModelEvaluationPage() {
  const modelsQuery = useModels();
  const datasetsQuery = useDatasets();

  const [selection, setSelection] = useState<DatasetSelection>(EMPTY_SELECTION);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [tab, setTab] = useState<TabId>('overview');
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  // History list state
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState<{ sort_by: string; order: 'asc' | 'desc' }>({
    sort_by: 'created_at',
    order: 'desc',
  });
  const [historyOffset, setHistoryOffset] = useState(0);

  const runDatasetEvaluation = useRunDatasetEvaluation();
  const compareMutation = useCompareModels();

  const historyQuery = useEvaluationHistory({
    search: historySearch || undefined,
    sort_by: historySort.sort_by as 'created_at',
    order: historySort.order,
    offset: historyOffset,
    limit: HISTORY_PAGE,
  });

  const historyDetail = useEvaluationDetail(viewingHistoryId);

  const models = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);
  const datasets = useMemo(() => datasetsQuery.data ?? [], [datasetsQuery.data]);

  const liveResult = runDatasetEvaluation.data;
  const storedResult = historyDetail.data?.result ?? null;
  const result: ComprehensiveEvaluation | null = (viewingHistoryId ? storedResult : liveResult) ?? null;

  const taskType = (result?.task_type ?? selection.taskType ?? 'classification') as TaskType;

  const blockers = useMemo(() => {
    const out: string[] = [];
    if (!selection.fileName) out.push('Upload or select a dataset to evaluate.');
    if (!selection.targetColumn) out.push('Select or confirm the target column to predict.');
    return out;
  }, [selection]);

  const handleRunEvaluation = useCallback(() => {
    setViewingHistoryId(null);
    setTab('overview');
    runDatasetEvaluation.mutate({
      file_name: selection.fileName,
      target_column: selection.targetColumn,
      task_type: selection.taskType,
    });
  }, [runDatasetEvaluation, selection]);

  const handleCompare = useCallback(() => {
    compareMutation.mutate({
      modelNames: compareSelection,
      datasetName: selection.fileName,
      targetColumn: selection.targetColumn,
    });
    setTab('compare');
  }, [compareMutation, compareSelection, selection.fileName, selection.targetColumn]);

  const handleSearchChange = useCallback((value: string) => {
    setHistorySearch(value);
    setHistoryOffset(0);
  }, []);

  const handleSortChange = useCallback((sort_by: string, order: 'asc' | 'desc') => {
    setHistorySort({ sort_by, order });
    setHistoryOffset(0);
  }, []);

  const resourceError = modelsQuery.isError || datasetsQuery.isError;
  const errorMessage =
    (modelsQuery.error && getErrorMessage(modelsQuery.error, 'Models could not be loaded.')) ||
    (datasetsQuery.error && getErrorMessage(datasetsQuery.error, 'Datasets could not be loaded.')) ||
    '';

  const runError = runDatasetEvaluation.isError
    ? getErrorMessage(runDatasetEvaluation.error, 'Evaluation could not be completed.')
    : null;
  const compareError = compareMutation.isError
    ? getErrorMessage(compareMutation.error, 'The comparison could not be completed.')
    : null;

  const unavailable = result?.unavailable ?? [];
  const basis = result
    ? `${result.train_size.toLocaleString()} train / ${result.test_size.toLocaleString()} test rows`
    : undefined;

  const isInitialLoad = modelsQuery.isLoading || datasetsQuery.isLoading;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Model Evaluation</h1>
          <p className={styles.pageSubtitle}>
            Upload a dataset and automatically analyze, preprocess, train, and evaluate baseline machine learning models.
          </p>
        </div>
      </header>

      {isInitialLoad ? (
        <div className={styles.loadingBlock}>
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonGrid}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonTile} />
            ))}
          </div>
        </div>
      ) : resourceError ? (
        <ErrorState
          title="Evaluation is unavailable"
          message={errorMessage}
          onRetry={() => {
            modelsQuery.refetch();
            datasetsQuery.refetch();
          }}
        />
      ) : (
        <EvaluationSetupPanel
          datasets={datasets}
          models={models}
          selection={selection}
          onChange={setSelection}
          onRunEvaluation={handleRunEvaluation}
          isRunning={runDatasetEvaluation.isPending}
          blockers={blockers}
          hasResult={Boolean(result)}
        />
      )}

      {runError && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle className={styles.errorIcon} />
          <div className={styles.errorBody}>
            <p className={styles.errorTitle}>{runError}</p>
            <p className={styles.errorDetail}>
              Metrics are calculated directly from real model predictions without placeholder data.
            </p>
          </div>
        </div>
      )}

      {runDatasetEvaluation.isPending && (
        <div className={styles.loadingBlock} aria-busy="true" aria-label="Evaluating dataset">
          <div className={styles.loadingProgressContainer}>
            <RefreshCw className={styles.spinningIcon} />
            <div className={styles.loadingTextGroup}>
              <h3 className={styles.loadingTitle}>Running AutoML Model Evaluation...</h3>
              <p className={styles.loadingSubtitle}>
                Preprocessing raw features, splitting train/test sets (80/20), training candidate baseline models, and computing real evaluation metrics.
              </p>
            </div>
          </div>
        </div>
      )}

      {!runDatasetEvaluation.isPending && !resourceError && (
        <nav className={styles.tabs} role="tablist" aria-label="Evaluation views">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              className={styles.tab}
              data-active={tab === id}
              onClick={() => setTab(id)}
            >
              <Icon className={styles.tabIcon} />
              {label}
            </button>
          ))}
        </nav>
      )}

      {result && !runDatasetEvaluation.isPending && tab !== 'compare' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.results}
        >
          <div className={styles.resultHeader}>
            <div className={styles.resultTitleGroup}>
              <h2 className={styles.resultTitle}>{result.model_name}</h2>
              <p className={styles.resultMeta}>
                Dataset: <strong>{result.dataset_name}</strong> · Target: <code>{result.target_column}</code> · Task: {result.task_type} · {basis}
              </p>
            </div>
            {viewingHistoryId && (
              <Button variant="secondary" size="sm" onClick={() => setViewingHistoryId(null)}>
                Back to live run
              </Button>
            )}
          </div>

          {result.warnings?.length > 0 && (
            <ul className={styles.warningList}>
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {tab === 'overview' && (
            <div className={styles.stack}>
              {/* Preprocessing Summary Card */}
              <PreprocessingSummaryCard
                steps={result.preprocessing_summary}
                trainSize={result.train_size}
                testSize={result.test_size}
                inputFeatures={result.input_feature_names || result.feature_names}
              />

              {/* Candidate Model Comparison Table */}
              {result.model_comparison && result.model_comparison.length > 0 && (
                <ModelComparisonTable
                  models={result.model_comparison}
                  bestModelName={result.best_model_name || result.model_name}
                  taskType={taskType}
                />
              )}

              {/* Primary Performance Metrics Grid */}
              <MetricGrid
                metrics={result.metrics}
                taskType={taskType}
                unavailable={unavailable}
              />

              {/* AI Insights & Observations */}
              <InsightsPanel insights={result.insights ?? []} basis={basis} />

              {/* Visualizations */}
              {taskType === 'classification' ? (
                <>
                  <ConfusionMatrixChart data={result.confusion_matrix} reason={reasonFor(unavailable, 'confusion')} />
                  <RocCurveChart data={result.roc_curve} reason={reasonFor(unavailable, 'ROC')} />
                </>
              ) : (
                <ResidualPlot data={result.residual_plot} />
              )}
            </div>
          )}

          {tab === 'curves' && (
            <div className={styles.stack}>
              <div className={styles.grid2}>
                <LearningCurve data={result.learning_curve} />
                <ValidationCurve data={result.validation_curve} />
              </div>
              {taskType === 'classification' && (
                <div className={styles.grid2}>
                  <RocCurveChart data={result.roc_curve} reason={reasonFor(unavailable, 'ROC')} />
                  <PrCurveChart data={result.pr_curve} reason={reasonFor(unavailable, 'precision-recall')} />
                </div>
              )}
              <PredictionDistribution data={result.prediction_distribution} />
            </div>
          )}

          {tab === 'diagnostics' && (
            <div className={styles.stack}>
              <FeatureImportanceChart data={result.feature_importance ?? []} />
              {unavailable.length > 0 && (
                <section className={styles.unavailableCard}>
                  <h3 className={styles.unavailableTitle}>Not available for this run</h3>
                  <ul className={styles.unavailableList}>
                    {unavailable.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {tab === 'predictions' && (
            <div className={styles.stack}>
              <PredictionSamplesTable
                data={result.prediction_samples ?? []}
                taskType={taskType}
                totalRows={result.test_size}
              />
            </div>
          )}
        </motion.div>
      )}

      {!result && !runDatasetEvaluation.isPending && !resourceError && tab !== 'compare' && (
        <EmptyState
          title="No evaluation to show yet"
          description="Upload or choose a dataset above, then click 'Evaluate Model'. The system will automatically analyze your data, train baseline models, and compute evaluation metrics."
        />
      )}

      {tab === 'compare' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.results}
        >
          <div className={styles.resultHeader}>
            <p className={styles.resultMeta}>
              {compareMutation.data
                ? `${compareMutation.data.results.length} model${compareMutation.data.results.length === 1 ? '' : 's'} on ${
                    selection.fileName || 'the selected dataset'
                  } · target ${selection.targetColumn || '—'}`
                : 'Evaluate several models on one shared test set so the scores are directly comparable.'}
            </p>
          </div>

          <ComparisonPanel
            results={compareMutation.data?.results ?? []}
            isLoading={compareMutation.isPending}
            isError={compareMutation.isError}
            errorMessage={compareError ?? undefined}
            onRetry={handleCompare}
          />

          {!compareMutation.data && !compareMutation.isPending && !compareMutation.isError && (
            <EmptyState
              title="No comparison run yet"
              description="Select two or more models of the same task in the setup panel, then run the comparison."
            />
          )}
        </motion.div>
      )}

      {!isInitialLoad && !resourceError && (
        <EvaluationHistoryPanel
          items={historyQuery.data?.evaluations ?? []}
          total={historyQuery.data?.total ?? 0}
          offset={historyOffset}
          isLoading={historyQuery.isLoading}
          isFetching={historyQuery.isFetching}
          isError={historyQuery.isError}
          search={historySearch}
          sortBy={historySort.sort_by}
          order={historySort.order}
          activeId={viewingHistoryId ?? undefined}
          onPageChange={setHistoryOffset}
          onSearchChange={handleSearchChange}
          onSortChange={handleSortChange}
          onSelect={setViewingHistoryId}
          onRetry={() => historyQuery.refetch()}
        />
      )}

      {historyDetail.isLoading && viewingHistoryId && (
        <div className={styles.loadingBlock}>
          <div className={styles.skeletonRow} />
        </div>
      )}

      {historyDetail.isError && viewingHistoryId && (
        <ErrorState
          title="Stored evaluation unavailable"
          message={getErrorMessage(historyDetail.error, 'This evaluation could not be loaded.')}
          onRetry={() => historyDetail.refetch()}
        />
      )}
    </div>
  );
}

function reasonFor(unavailable: string[], needle: string): string | undefined {
  return unavailable.find((u) => u.toLowerCase().includes(needle.toLowerCase()));
}

export default ModelEvaluationPage;
