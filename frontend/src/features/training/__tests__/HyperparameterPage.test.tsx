import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('framer-motion', () => ({
  motion: Object.assign(
    {},
    {
      div: ({ children }: any) => <div>{children}</div>,
      aside: ({ children }: any) => <aside>{children}</aside>,
    },
  ),
}));

vi.mock('recharts', () => {
  const Stub = ({ children }: any) => <div data-testid="recharts">{children}</div>;
  return {
    ResponsiveContainer: Stub,
    LineChart: Stub,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
    ReferenceDot: () => null,
  };
});

const tuningMock = vi.hoisted(() => ({
  availability: vi.fn(),
  params: vi.fn(),
  analyzeTarget: vi.fn(),
  run: vi.fn(),
  cancel: vi.fn(),
  subscribeProgress: vi.fn<(jobId: string, onProgress: (data: Record<string, any>) => void) => () => void>(() => () => {}),
  getResults: vi.fn(),
  experiments: vi.fn(),
  experimentDetail: vi.fn(),
  rerunExperiment: vi.fn(),
  deleteExperiment: vi.fn(),
}));

vi.mock('../../../services/tuning.service', () => ({ tuningService: tuningMock }));

vi.mock('../../../services/datasets.service', () => ({
  datasetsService: { list: vi.fn().mockResolvedValue({ datasets: [] }) },
}));

vi.mock('../../../services/projects.service', () => ({
  projectsService: { list: vi.fn().mockResolvedValue({ projects: [] }) },
}));

import HyperparameterPage from '../pages/HyperparameterPage';

const exp1 = {
  id: 'exp1',
  name: 'churn · grid',
  config: {
    file_name: 'churn.csv',
    target_column: 'churn',
    method: 'grid',
    cv_folds: 5,
    n_iter: 20,
    models: ['GradientBoosting'],
    task_type: 'classification',
  },
  status: 'completed',
  best_model: 'GradientBoosting',
  best_score: 0.87,
  saved_model_name: 'churn_GradientBoosting.pkl',
  best_params: { n_estimators: 200 },
  trials: [{ name: 'GradientBoosting', params: { n_estimators: 200 }, score: 0.87 }],
  total: 1,
  started_at: '2026-10-01T10:00:00',
};

const exp2 = {
  id: 'exp2',
  name: 'churn · random',
  config: {
    file_name: 'churn.csv',
    target_column: 'churn',
    method: 'random',
    cv_folds: 5,
    n_iter: 40,
    models: ['RandomForest'],
    task_type: 'classification',
  },
  status: 'cancelled',
  best_model: 'RandomForest',
  best_score: 0.85,
  trials: [{ name: 'RandomForest', params: { n_estimators: 120 }, score: 0.85 }],
  total: 1,
  started_at: '2026-10-01T10:01:00',
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HyperparameterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { qc, view };
}

beforeEach(() => {
  vi.clearAllMocks();
  tuningMock.availability.mockResolvedValue({
    optuna: false,
    bayesian: false,
    grid: true,
    random: true,
    param_ranges: {},
    classification_models: ['GradientBoosting', 'RandomForest'],
  });
  tuningMock.experiments.mockResolvedValue({ experiments: [exp1, exp2], total: 2, offset: 0, limit: 50 });
  navigateMock.mockClear();
});

describe('HyperparameterPage history', () => {
  it('renders saved experiments with status, model and actions', async () => {
    renderPage();
    expect(await screen.findByText('churn · grid')).toBeInTheDocument();
    expect(screen.getByText('churn · random')).toBeInTheDocument();
    expect(screen.getByText('2 saved')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('GradientBoosting')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('shows a compare table when two experiments are selected', async () => {
    renderPage();
    await screen.findByText('churn · grid');
    const compareBoxes = within(screen.getByRole('table')).getAllByRole('checkbox');
    fireEvent.click(compareBoxes[0]);
    fireEvent.click(compareBoxes[1]);
    expect(await screen.findByText('Compare 2 experiments')).toBeInTheDocument();
    expect(screen.getByText('Best score')).toBeInTheDocument();
    expect(screen.getAllByText('87.00%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('85.00%').length).toBeGreaterThanOrEqual(1);
  });

  it('opens a saved experiment into the results workspace', async () => {
    renderPage();
    const row = (await screen.findByText('churn · grid')).closest('tr')!;
    fireEvent.click(within(row).getAllByRole('button')[0]);
    expect(await screen.findByText('Optimization Complete')).toBeInTheDocument();
    expect(screen.getByText('churn_GradientBoosting.pkl')).toBeInTheDocument();
    expect(screen.getByText('View in Model Registry')).toBeInTheDocument();
  });

  it('navigates to the model registry from the completed best model', async () => {
    renderPage();
    const row = (await screen.findByText('churn · grid')).closest('tr')!;
    fireEvent.click(within(row).getAllByRole('button')[0]);
    fireEvent.click(await screen.findByText('View in Model Registry'));
    expect(navigateMock).toHaveBeenCalledWith('/app/models');
  });

  it('re-runs a stored experiment and starts a live job', async () => {
    tuningMock.rerunExperiment.mockResolvedValue({ job_id: 'jobB', status: 'queued', rerun_of: 'exp1' });
    renderPage();
    const row = (await screen.findByText('churn · grid')).closest('tr')!;
    fireEvent.click(within(row).getAllByRole('button')[1]);
    expect(tuningMock.rerunExperiment).toHaveBeenCalledWith('exp1');
    await vi.waitFor(() => {
      expect(tuningMock.subscribeProgress).toHaveBeenCalledWith('jobB', expect.any(Function));
    });

    // Drive the live run to completion.
    const handler = tuningMock.subscribeProgress.mock.calls.find((c) => c[0] === 'jobB')![1];
    handler({
      status: 'completed',
      current: 1,
      total: 1,
      best_model: 'GradientBoosting',
      best_score: 0.91,
      model_results: [{ name: 'GradientBoosting', params: { n_estimators: 220 }, score: 0.91 }],
    });
    expect(await screen.findByText('Optimization Complete')).toBeInTheDocument();
    expect(screen.getAllByText('91.00%').length).toBeGreaterThanOrEqual(1);
  });

  it('deletes an experiment from history after confirmation', async () => {
    tuningMock.deleteExperiment.mockResolvedValue({ status: 'deleted', id: 'exp2' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      renderPage();
      const row = (await screen.findByText('churn · random')).closest('tr')!;
      const buttons = within(row).getAllByRole('button');
      fireEvent.click(buttons[buttons.length - 1]);
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(tuningMock.deleteExperiment).toHaveBeenCalledWith('exp2');
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('does not delete when the confirmation is declined', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      renderPage();
      const row = (await screen.findByText('churn · random')).closest('tr')!;
      const buttons = within(row).getAllByRole('button');
      fireEvent.click(buttons[buttons.length - 1]);
      expect(tuningMock.deleteExperiment).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
    }
  });
});