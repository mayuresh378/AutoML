import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { evaluationService } from '../services/evaluation.service';
import { ModelEvaluationPage } from '../pages/ModelEvaluationPage';
import type {
  ComprehensiveEvaluation,
  DatasetAnalyzeResponse,
} from '../services/evaluation.service';

vi.mock('recharts', () => {
  const Stub = ({ children }: any) => <div data-testid="recharts">{children}</div>;
  return {
    ResponsiveContainer: Stub,
    AreaChart: Stub,
    BarChart: Stub,
    ScatterChart: Stub,
    LineChart: Stub,
    Area: () => null,
    Bar: () => null,
    Scatter: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Cell: () => null,
    ReferenceLine: () => null,
  };
});

const models = [
  {
    id: 'm1',
    name: 'iris_rf.pkl',
    algorithm: 'random_forest',
    task_type: 'classification',
    dataset_name: 'iris.csv',
    target_column: 'species',
    status: 'ready' as const,
    version: 1,
    framework: 'sklearn',
    cv_score: 0.95,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const datasets = [
  {
    id: 'd1',
    name: 'iris.csv',
    rows: 150,
    columns: ['sepal_length', 'sepal_width', 'petal_length', 'petal_width', 'species'],
    size_kb: 3,
    status: 'ready' as const,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const evaluation: ComprehensiveEvaluation = {
  model_name: 'iris_rf.pkl',
  dataset_name: 'iris.csv',
  target_column: 'species',
  task_type: 'classification',
  input_feature_names: ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'],
  feature_names: ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'],
  metrics: { accuracy: 0.96, precision: 0.95, recall: 0.95, f1: 0.95, roc_auc: 0.99 },
  train_size: 120,
  test_size: 30,
  confusion_matrix: { labels: ['a', 'b'], matrix: [[14, 1], [1, 14]] },
  roc_curve: { fpr: [0, 1], tpr: [0, 1], auc: 0.99 },
  pr_curve: { precision: [1, 0.9], recall: [0, 1], average_precision: 0.97 },
  feature_importance: [
    { feature: 'petal_length', importance: 0.4, normalized: 1 },
    { feature: 'petal_width', importance: 0.3, normalized: 0.75 },
  ],
  learning_curve: {
    train_sizes: [10, 20],
    train_mean: [0.9, 0.95],
    train_std: [0.01, 0.01],
    val_mean: [0.85, 0.92],
    val_std: [0.02, 0.02],
    scoring: 'accuracy',
  },
  validation_curve: {
    param_name: 'n_estimators',
    param_range: ['10', '20'],
    train_mean: [0.9, 0.95],
    train_std: [0.01, 0.01],
    val_mean: [0.85, 0.92],
    val_std: [0.02, 0.02],
    scoring: 'accuracy',
  },
  residual_plot: null,
  prediction_distribution: {
    type: 'classification',
    predictions: [{ label: 'a', count: 15, pct: 50 }],
    total: 30,
  },
  prediction_samples: [{ actual: 'a', predicted: 'a', correct: true, probability: { a: 0.98 } }],
  class_distribution: [{ label: 'a', count: 15, pct: 50 }],
  insights: [
    { key: 'overall', severity: 'positive', title: 'Strong accuracy', detail: 'Accuracy 0.96 on 30 test rows.' },
  ],
  ai_insights: 'Strong accuracy',
  warnings: [],
  unavailable: [],
  evaluation_id: 'ev_1',
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ModelEvaluationPage />
    </QueryClientProvider>,
  );
}

vi.mock('../../../hooks/useApi', () => ({
  useModels: () => ({ data: models, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useDatasets: () => ({ data: datasets, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));

vi.mock('../services/evaluation.service', async () => {
  const actual = await vi.importActual<typeof import('../services/evaluation.service')>(
    '../services/evaluation.service',
  );
  return {
    ...actual,
    evaluationService: {
      evaluate: vi.fn(),
      analyzeDataset: vi.fn(),
      evaluateDataset: vi.fn(),
      compare: vi.fn(),
      history: vi.fn(),
      get: vi.fn(),
    },
  };
});

const analysis: DatasetAnalyzeResponse = {
  file_name: 'iris.csv',
  rows: 150,
  columns: ['sepal_length', 'sepal_width', 'petal_length', 'petal_width', 'species'],
  missing_count: 0,
  duplicate_count: 0,
  dtypes: {},
  suggested_target: 'species',
  target_confidence: 'High' as const,
  detected_task_type: 'classification' as const,
  potential_id_columns: [],
  numeric_columns: ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'],
  categorical_columns: ['species'],
  preview_data: [],
};

/**
 * The page is dataset-driven: picking a dataset triggers an analyze call that
 * preselects the target, then "Evaluate Model" runs the AutoML baseline via
 * evaluateDataset. These helpers drive that real sequence instead of the removed
 * model-selector UI.
 */
async function selectDataset() {
  // Several native <select> elements exist (dataset, then target + task once
  // analysis returns), and the dataset one has no <label>, so pick the
  // control that actually offers the dataset as an option.
  const selects = await screen.findAllByRole('combobox');
  const datasetSelect = selects.find((el) =>
    Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'iris.csv'),
  )!;
  fireEvent.change(datasetSelect, { target: { value: 'iris.csv' } });
  await waitFor(() =>
    expect(screen.getByText('Auto-Detected (High Confidence)')).toBeInTheDocument(),
  );
}

async function runEvaluation() {
  const button = await screen.findByRole('button', { name: /evaluate model/i });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

describe('ModelEvaluationPage', () => {
  beforeEach(() => {
    // Clear call history so assertions like `not.toHaveBeenCalled()` are
    // scoped to the current test. Implementations survive clearAllMocks.
    vi.clearAllMocks();
    vi.mocked(evaluationService.history).mockResolvedValue({
      evaluations: [],
      total: 0,
      offset: 0,
      limit: 10,
    });
  });

  it('blocks the run until a dataset is chosen, and explains why', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Model Evaluation' });
    expect(screen.getByText('Upload or select a dataset to evaluate.')).toBeInTheDocument();
    expect(screen.getByText('Select or confirm the target column to predict.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /evaluate model/i })).toBeDisabled();
    // Nothing may run before a dataset exists.
    expect(evaluationService.evaluateDataset).not.toHaveBeenCalled();
  });

  it('preselects the target and task type from the real analyze response', async () => {
    vi.mocked(evaluationService.analyzeDataset).mockResolvedValue(analysis);
    renderPage();

    await selectDataset();

    expect(evaluationService.analyzeDataset).toHaveBeenCalledWith('iris.csv', undefined);
    // Target comes from the backend suggestion, not a hardcoded value.
    expect(screen.getByText('species (Suggested Target)')).toBeInTheDocument();
    expect(screen.getByText('Auto-Detected (High Confidence)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /evaluate model/i })).toBeEnabled();
  });

  it('runs the dataset evaluation and renders the real result', async () => {
    vi.mocked(evaluationService.analyzeDataset).mockResolvedValue(analysis);
    vi.mocked(evaluationService.evaluateDataset).mockResolvedValue(evaluation);
    renderPage();

    await selectDataset();
    await runEvaluation();

    await waitFor(() => expect(screen.getByText('0.9600')).toBeInTheDocument());
    // The dataset-driven endpoint is used, not the saved-model one.
    expect(evaluationService.evaluateDataset).toHaveBeenCalledWith({
      file_name: 'iris.csv',
      target_column: 'species',
      task_type: 'classification',
    });
    expect(evaluationService.evaluate).not.toHaveBeenCalled();
    expect(screen.getByText('120 train / 30 test rows')).toBeInTheDocument();
  });

  it('surfaces a server error and never fabricates metrics', async () => {
    vi.mocked(evaluationService.analyzeDataset).mockResolvedValue(analysis);
    vi.mocked(evaluationService.evaluateDataset).mockRejectedValue(
      new Error('Target column not found in dataset'),
    );
    renderPage();

    await selectDataset();
    await runEvaluation();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/Target column not found/)).toBeInTheDocument();
    // No placeholder KPI may appear after a failure.
    expect(screen.queryByText('0.9600')).not.toBeInTheDocument();
  });

  it('reports unsupported metrics instead of hiding them', async () => {
    vi.mocked(evaluationService.analyzeDataset).mockResolvedValue(analysis);
    vi.mocked(evaluationService.evaluateDataset).mockResolvedValue({
      ...evaluation,
      metrics: { accuracy: 0.9 },
      roc_curve: null,
      pr_curve: null,
      unavailable: ['ROC curve could not be computed: AttributeError'],
    });
    renderPage();

    await selectDataset();
    await runEvaluation();

    await waitFor(() => expect(screen.getByText('0.9000')).toBeInTheDocument());
    const rocTile = screen.getByText('ROC AUC').closest('[data-empty="true"]')!;
    expect(rocTile).not.toBeNull();
    // The reason is surfaced rather than the tile silently disappearing.
    expect(screen.getAllByText(/ROC curve could not be computed/).length).toBeGreaterThan(0);
  });

  it('shows an empty history before anything has been evaluated', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Evaluation history')).toBeInTheDocument());
    expect(await screen.findByText('No evaluations yet')).toBeInTheDocument();
  });

  it('compares the models the user actually selects, on one shared split', async () => {
    // Regression: compareSelection could never be populated, so the Compare tab
    // was unreachable dead UI even though /models/compare works.
    vi.mocked(evaluationService.analyzeDataset).mockResolvedValue(analysis);
    vi.mocked(evaluationService.compare).mockResolvedValue({
      results: [
        { model_name: 'iris_rf.pkl', task_type: 'classification', metrics: { accuracy: 0.96 } },
        { model_name: 'broken.pkl', error: "Model 'broken.pkl' not found" },
      ],
      total: 2,
      failed: 1,
    });
    renderPage();

    await selectDataset();

    // Nothing is sent until models are explicitly ticked.
    expect(evaluationService.compare).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /iris_rf\.pkl/ }));
    fireEvent.click(screen.getByRole('button', { name: /compare 1 model/i }));

    await waitFor(() => expect(evaluationService.compare).toHaveBeenCalled());
    expect(evaluationService.compare).toHaveBeenCalledWith(['iris_rf.pkl'], 'iris.csv', 'species');

    // A single failed model must not hide the successful one.
    await waitFor(() => expect(screen.getByText("Model 'broken.pkl' not found")).toBeInTheDocument());
    expect(screen.getByRole('cell', { name: /iris_rf\.pkl/ })).toBeInTheDocument();
  });

  it('deselecting a model updates the compare count and disables the action', async () => {
    vi.mocked(evaluationService.analyzeDataset).mockResolvedValue(analysis);
    renderPage();

    await selectDataset();
    fireEvent.click(screen.getByRole('checkbox', { name: /iris_rf\.pkl/ }));
    expect(screen.getByRole('button', { name: /compare 1 model/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /iris_rf\.pkl/ }));
    expect(screen.getByRole('button', { name: /compare 0 models/i })).toBeDisabled();
    expect(evaluationService.compare).not.toHaveBeenCalled();
  });

  it('renders the narrative ai_insights the backend returns', async () => {
    // Regression: ai_insights was returned and typed but rendered nowhere.
    vi.mocked(evaluationService.analyzeDataset).mockResolvedValue(analysis);
    vi.mocked(evaluationService.evaluateDataset).mockResolvedValue({
      ...evaluation,
      ai_insights: 'Accuracy is strong on 30 test rows.\nWatch the 11-row minority class.',
    });
    renderPage();

    await selectDataset();
    await runEvaluation();

    await waitFor(() => expect(screen.getByRole('region', { name: /ai insights/i })).toBeInTheDocument());
    expect(screen.getByText(/Accuracy is strong on 30 test rows/)).toBeInTheDocument();
    expect(screen.getByText(/Watch the 11-row minority class/)).toBeInTheDocument();
  });

  it('renders a stored result that has no split sizes instead of crashing', async () => {
    // Regression: result.train_size.toLocaleString() threw on older records.
    vi.mocked(evaluationService.analyzeDataset).mockResolvedValue(analysis);
    vi.mocked(evaluationService.history).mockResolvedValue({
      evaluations: [
        {
          id: 'ev_nosplit',
          model_name: 'iris_rf.pkl',
          dataset_name: 'iris.csv',
          target_column: 'species',
          task_type: 'classification',
          metrics: { accuracy: 0.9 },
          created_at: '2026-01-02T10:00:00Z',
        },
      ],
      total: 1,
      offset: 0,
      limit: 10,
    });
    const noSplit = { ...evaluation } as Record<string, unknown>;
    delete noSplit.train_size;
    delete noSplit.test_size;
    // Mirrors the live API shape: `result` is null, payload in `results_summary`.
    vi.mocked(evaluationService.get).mockResolvedValue({
      id: 'ev_nosplit',
      model_name: 'iris_rf.pkl',
      dataset_name: 'iris.csv',
      target_column: 'species',
      task_type: 'classification',
      metrics: evaluation.metrics,
      result: null,
      results_summary: noSplit as unknown as ComprehensiveEvaluation,
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /view/i }));
    await waitFor(() => expect(evaluationService.get).toHaveBeenCalledWith('ev_nosplit'));

    // Must not throw. With both sizes absent the split is omitted entirely
    // rather than printing '? train / ? test rows'.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'iris_rf.pkl' })).toBeInTheDocument());
    expect(
      screen.queryByText((_content, el) =>
        /train \/ .*test rows/.test(el?.textContent ?? '') && el?.tagName === 'P',
      ),
    ).not.toBeInTheDocument();

    });

  it('renders a partial split without crashing', async () => {
    // One size present, one missing: the missing half must degrade to '?'.
    vi.mocked(evaluationService.analyzeDataset).mockResolvedValue(analysis);
    vi.mocked(evaluationService.history).mockResolvedValue({
      evaluations: [
        {
          id: 'ev_partial',
          model_name: 'iris_rf.pkl',
          dataset_name: 'iris.csv',
          target_column: 'species',
          task_type: 'classification',
          metrics: { accuracy: 0.9 },
          created_at: '2026-01-02T10:00:00Z',
        },
      ],
      total: 1,
      offset: 0,
      limit: 10,
    });
    vi.mocked(evaluationService.get).mockResolvedValue({
      id: 'ev_partial',
      model_name: 'iris_rf.pkl',
      dataset_name: 'iris.csv',
      target_column: 'species',
      task_type: 'classification',
      metrics: evaluation.metrics,
      result: null,
      results_summary: {
        ...evaluation,
        train_size: evaluation.train_size,
        test_size: undefined as unknown as number,
      },
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /view/i }));
    await waitFor(() => expect(evaluationService.get).toHaveBeenCalledWith('ev_partial'));
    await waitFor(() =>
      expect(
        screen.getByText((_content, el) =>
          /\d[\d,]* train \/ \? test rows/.test(el?.textContent ?? '') && el?.tagName === 'P',
        ),
      ).toBeInTheDocument(),
    );
  });

  it('derives regression from a numeric suggested target', async () => {
    // Regression: `selection.taskType || data.detected_task_type` could never
    // apply detection because taskType always held the classification default.
    vi.mocked(evaluationService.analyzeDataset).mockResolvedValue({
      ...analysis,
      suggested_target: 'age',
      detected_task_type: 'regression',
      numeric_columns: ['age', 'tenure'],
      columns: ['age', 'tenure'],
    });
    vi.mocked(evaluationService.evaluateDataset).mockResolvedValue(evaluation);
    renderPage();

    await selectDataset();
    await runEvaluation();

    // The numeric target must reach the request as a regression task.
    expect(evaluationService.evaluateDataset).toHaveBeenCalledWith({
      file_name: 'iris.csv',
      target_column: 'age',
      task_type: 'regression',
    });
  });

  it('keeps history scoped and searchable through the service', async () => {
    vi.mocked(evaluationService.history).mockResolvedValue({
      evaluations: [
        {
          id: 'ev_9',
          model_name: 'iris_rf.pkl',
          dataset_name: 'iris.csv',
          target_column: 'species',
          task_type: 'classification',
          metrics: { accuracy: 0.96 },
          created_at: '2026-01-02T10:00:00Z',
        },
      ],
      total: 1,
      offset: 0,
      limit: 10,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('iris_rf.pkl')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Search evaluation history'), {
      target: { value: 'iris' },
    });
    await waitFor(() => {
      const calls = vi.mocked(evaluationService.history).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[0]?.search).toBe('iris');
    });
  });
});
