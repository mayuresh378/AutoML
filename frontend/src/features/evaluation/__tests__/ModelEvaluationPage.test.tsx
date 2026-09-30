import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { evaluationService } from '../services/evaluation.service';
import { ModelEvaluationPage } from '../pages/ModelEvaluationPage';
import type { ComprehensiveEvaluation } from '../services/evaluation.service';

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
    name: 'iris',
    filename: 'iris.csv',
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
      compare: vi.fn(),
      history: vi.fn(),
      get: vi.fn(),
    },
  };
});

describe('ModelEvaluationPage', () => {
  beforeEach(() => {
    vi.mocked(evaluationService.history).mockResolvedValue({ evaluations: [], total: 0, offset: 0, limit: 10 });
  });

  it('blocks the run until a full selection is made, and explains why', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Evaluation setup')).toBeInTheDocument());

    expect(screen.getByText('Select a model to evaluate.')).toBeInTheDocument();
    expect(screen.getByText('Select a dataset to evaluate against.')).toBeInTheDocument();
    expect(screen.getByText('Select the target column to predict.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run evaluation/i })).toBeDisabled();
  });

  it('preselects the training target once model and dataset are chosen', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Evaluation setup')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'iris_rf.pkl' } });
    fireEvent.change(screen.getByLabelText('Dataset'), { target: { value: 'iris.csv' } });

    await waitFor(() => expect(screen.getByLabelText('Target column')).toHaveValue('species'));
    await waitFor(() => expect(screen.getByRole('button', { name: /run evaluation/i })).toBeEnabled());
  });

  it('runs an evaluation and renders the real result', async () => {
    vi.mocked(evaluationService.evaluate).mockResolvedValue(evaluation);
    renderPage();
    await waitFor(() => expect(screen.getByText('Evaluation setup')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'iris_rf.pkl' } });
    fireEvent.change(screen.getByLabelText('Dataset'), { target: { value: 'iris.csv' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run evaluation/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /run evaluation/i }));

    await waitFor(() => expect(screen.getByText('0.9600')).toBeInTheDocument());
    expect(evaluationService.evaluate).toHaveBeenCalledWith({
      model_name: 'iris_rf.pkl',
      dataset_name: 'iris.csv',
      target_column: 'species',
    });
    // Result header proves which model/dataset/target produced the numbers.
    const header = screen.getByRole('heading', { name: 'iris_rf.pkl' });
    expect(header).toBeInTheDocument();
    expect(header.parentElement).toHaveTextContent('iris.csv');
    expect(header.parentElement).toHaveTextContent('species');
    expect(screen.getByText('120 train / 30 test rows')).toBeInTheDocument();
  });

  it('surfaces a server error with a retry path and no fabricated metrics', async () => {
    vi.mocked(evaluationService.evaluate).mockRejectedValue(
      new Error("Dataset is missing 3 features required by the model: a, b, c"),
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('Evaluation setup')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'iris_rf.pkl' } });
    fireEvent.change(screen.getByLabelText('Dataset'), { target: { value: 'iris.csv' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run evaluation/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /run evaluation/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/missing 3 features/)).toBeInTheDocument();
    // No placeholder KPI may appear after a failure.
    expect(screen.queryByText('0.9600')).not.toBeInTheDocument();
  });

  it('reports unsupported metrics instead of hiding them', async () => {
    vi.mocked(evaluationService.evaluate).mockResolvedValue({
      ...evaluation,
      metrics: { accuracy: 0.9 },
      roc_curve: null,
      pr_curve: null,
      unavailable: ['ROC curve could not be computed: AttributeError'],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Evaluation setup')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'iris_rf.pkl' } });
    fireEvent.change(screen.getByLabelText('Dataset'), { target: { value: 'iris.csv' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run evaluation/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /run evaluation/i }));

    await waitFor(() => expect(screen.getByText('0.9000')).toBeInTheDocument());
    const rocTile = screen.getByText('ROC AUC').closest('[data-empty="true"]')!;
    expect(rocTile).not.toBeNull();
  });

  it('shows an empty history before anything has been evaluated', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Evaluation history')).toBeInTheDocument());
    expect(await screen.findByText('No evaluations yet')).toBeInTheDocument();
  });

  it('passes the selection to the comparison endpoint on one shared split', async () => {
    vi.mocked(evaluationService.compare).mockResolvedValue({
      results: [
        { model_name: 'iris_rf.pkl', task_type: 'classification', metrics: { accuracy: 0.96 } },
        { model_name: 'broken.pkl', error: "Model 'broken.pkl' not found" },
      ],
      total: 2,
      failed: 1,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Evaluation setup')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'iris_rf.pkl' } });
    fireEvent.change(screen.getByLabelText('Dataset'), { target: { value: 'iris.csv' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run evaluation/i })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: /choose models to compare/i }));
    fireEvent.click(screen.getByRole('button', { name: /compare 1 model/i }));

    await waitFor(() => expect(evaluationService.compare).toHaveBeenCalled());
    expect(evaluationService.compare).toHaveBeenCalledWith(['iris_rf.pkl'], 'iris.csv', 'species');
    // A single failed model must not hide the successful one.
    await waitFor(() => expect(screen.getByText('Model comparison')).toBeInTheDocument());
    expect(screen.getByText("Model 'broken.pkl' not found")).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /iris_rf\.pkl/ })).toBeInTheDocument();
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
