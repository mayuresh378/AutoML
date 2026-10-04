import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('framer-motion', () => ({
  motion: Object.assign({}, { div: ({ children }: any) => <div>{children}</div> }),
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('recharts', () => {
  const Stub = ({ children }: any) => <div data-testid="recharts">{children}</div>;
  return {
    ResponsiveContainer: Stub, BarChart: Stub, Bar: () => null, XAxis: () => null, YAxis: () => null,
    CartesianGrid: () => null, Tooltip: () => null, Cell: () => null,
  };
});

/**
 * Frames captured verbatim from GET /api/v1/training/{job_id}/progress after
 * training real models through POST /api/v1/training/run.
 */
const REGRESSION_FRAME = {
  status: 'completed', progress: 100, current_step: 'complete',
  message: 'Best model: KNN (r2=0.85)', task_type: 'regression', rank_metric: 'r2',
  failed_count: 0, elapsed: 3.9, start_time: 1, logs: [],
  metrics_history: [
    { model: 'Ridge', mse: 19.2201, rmse: 4.3841, mae: 3.4021, r2: -0.0645, cv_score: 0.0312 },
    { model: 'DecisionTree', mse: 9.4, rmse: 3.0663, mae: 2.4, r2: 0.7427, cv_score: 0.7833 },
    { model: 'KNN', mse: 5.3521, rmse: 2.3135, mae: 1.8, r2: 0.85, cv_score: 0.8747 },
  ],
  all_results: [
    { name: 'Ridge', status: 'success', metrics: { mse: 19.2201, rmse: 4.3841, mae: 3.4021, r2: -0.0645 }, cv_score: 0.0312, training_time: 0.11, time: 0.11 },
    { name: 'DecisionTree', status: 'success', metrics: { mse: 9.4, rmse: 3.0663, mae: 2.4, r2: 0.7427 }, cv_score: 0.7833, training_time: 0.14, time: 0.14 },
    { name: 'KNN', status: 'success', metrics: { mse: 5.3521, rmse: 2.3135, mae: 1.8, r2: 0.85 }, cv_score: 0.8747, training_time: 0.14, time: 0.14 },
  ],
  best_model: { name: 'KNN', status: 'success', metrics: { r2: 0.85 }, cv_score: 0.8747 },
};

/** The broken payload: every algorithm raised, so no metrics existed. */
const ALL_FAILED_FRAME = {
  status: 'completed', progress: 100, task_type: 'regression', rank_metric: 'r2',
  message: 'Best model: Ridge', logs: [], metrics_history: [],
  all_results: [
    { name: 'Ridge', error: "TypeError: got an unexpected keyword argument 'squared'" },
    { name: 'DecisionTree', error: "TypeError: got an unexpected keyword argument 'squared'" },
    { name: 'KNN', error: "TypeError: got an unexpected keyword argument 'squared'" },
  ],
};

const CLASSIFICATION_FRAME = {
  status: 'completed', progress: 100, task_type: 'classification', rank_metric: 'accuracy',
  message: 'Best model: LogisticRegression (accuracy=0.875)', logs: [],
  metrics_history: [
    { model: 'DecisionTree', accuracy: 0.8412, f1: 0.84, cv_score: 0.8505 },
    { model: 'LogisticRegression', accuracy: 0.875, f1: 0.87, cv_score: 0.8912 },
  ],
  all_results: [
    { name: 'DecisionTree', status: 'success', metrics: { accuracy: 0.8412, precision: 0.84, recall: 0.84, f1: 0.84 }, cv_score: 0.8505, training_time: 0.12, time: 0.12 },
    { name: 'LogisticRegression', status: 'success', metrics: { accuracy: 0.875, precision: 0.87, recall: 0.87, f1: 0.87 }, cv_score: 0.8912, training_time: 0.51, time: 0.51 },
  ],
  best_model: { name: 'LogisticRegression', status: 'success', metrics: { accuracy: 0.875 }, cv_score: 0.8912 },
};

const DATASETS = [{
  name: 'universal_all_features_here.csv',
  columns: ['num_1', 'target_reg', 'target_class'],
}];

const trainingMock = vi.hoisted(() => ({
  runWorkflow: vi.fn(),
  subscribeProgress: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('../../../services/training.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/training.service')>();
  return { ...actual, trainingService: { ...actual.trainingService, ...trainingMock } };
});

import { TrainingWorkflow } from '../components/TrainingWorkflow';
import { normalizeProgress } from '../../../services/training.service';

/**
 * Mirrors the real service: a raw `data:` frame from the SSE stream goes
 * through normalizeProgress before it reaches component state.
 *
 * Returns the holder, not the function, because the callback is only wired up
 * once trainingService.subscribeProgress is actually called.
 */
function streamFrom() {
  const handle: { emit: (frame: any) => void } = { emit: () => {} };
  trainingMock.subscribeProgress.mockImplementation((_id: string, cb: (f: any) => void) => {
    handle.emit = (frame: any) => cb(normalizeProgress(frame));
    return () => {};
  });
  return handle;
}

/** Walks the wizard to the Hyperparameters step with the given task type. */
async function goToTrainingStep(task: 'Classification' | 'Regression') {
  render(<MemoryRouter><TrainingWorkflow datasets={DATASETS as any} /></MemoryRouter>);
  fireEvent.click(screen.getByText(task));
  fireEvent.change(screen.getByDisplayValue('Choose a dataset'), { target: { value: DATASETS[0].name } });
  fireEvent.change(screen.getByDisplayValue('Choose target'), { target: { value: 'target_reg' } });
  fireEvent.click(screen.getByText(/Continue/));
  fireEvent.click(screen.getByText(/Continue/));
  return screen.getByText(/Start Training/);
}

function rowFor(table: HTMLElement, algorithm: string): HTMLElement {
  return within(table).getByText(algorithm).closest('tr') as HTMLElement;
}

beforeEach(() => {
  trainingMock.runWorkflow.mockReset();
  trainingMock.subscribeProgress.mockReset();
  trainingMock.runWorkflow.mockResolvedValue({ job_id: 'job123', status: 'queued' });
});

describe('Training results table (real captured payloads)', () => {
  it('renders real regression metrics with R², never a fake accuracy', async () => {
    const stream = streamFrom();

    const start = await goToTrainingStep('Regression');
    fireEvent.click(start);

    await waitFor(() => expect(trainingMock.subscribeProgress).toHaveBeenCalled());
    expect(trainingMock.runWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ file_name: DATASETS[0].name, target_column: 'target_reg', task_type: 'regression' }),
    );

    stream.emit(REGRESSION_FRAME);

    const table = await screen.findByRole('table');
    // Headline column follows the task.
    expect(within(table).getByText('R²')).toBeInTheDocument();
    expect(within(table).queryByText('Accuracy')).not.toBeInTheDocument();
    // Regression error metrics are reported, lower-is-better ones included.
    expect(within(table).getByText('RMSE')).toBeInTheDocument();
    expect(within(table).getByText('MAE')).toBeInTheDocument();

    // No cell is a bare "s" any more, and real timings are shown.
    expect(table.textContent).not.toMatch(/s<\/td>/);
    expect(rowFor(table, 'KNN').textContent).toContain('0.14s');

    // Values are the real measured ones.
    expect(rowFor(table, 'KNN').textContent).toContain('0.8500');
    expect(rowFor(table, 'KNN').textContent).toContain('87.5%');
    expect(rowFor(table, 'Ridge').textContent).toContain('-0.0645');
  });

  it('marks the highest-scoring model Best, not the first or Ridge', async () => {
    const stream = streamFrom();
    const start = await goToTrainingStep('Regression');
    fireEvent.click(start);
    await waitFor(() => expect(trainingMock.subscribeProgress).toHaveBeenCalled());
    stream.emit(REGRESSION_FRAME);

    const table = await screen.findByRole('table');
    // Highest R² wins, even though Ridge is listed first and scores negative.
    expect(within(rowFor(table, 'KNN')).getByText('Best')).toBeInTheDocument();
    expect(within(rowFor(table, 'Ridge')).queryByText('Best')).not.toBeInTheDocument();
    expect(within(rowFor(table, 'DecisionTree')).queryByText('Best')).not.toBeInTheDocument();
  });

  it('renders real classification metrics with Accuracy', async () => {
    const stream = streamFrom();
    const start = await goToTrainingStep('Classification');
    fireEvent.click(start);
    await waitFor(() => expect(trainingMock.subscribeProgress).toHaveBeenCalled());
    stream.emit(CLASSIFICATION_FRAME);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Accuracy')).toBeInTheDocument();
    expect(within(table).getByText('F1')).toBeInTheDocument();
    expect(rowFor(table, 'LogisticRegression').textContent).toContain('87.5%');
    expect(rowFor(table, 'LogisticRegression').textContent).toContain('0.51s');
    expect(within(rowFor(table, 'LogisticRegression')).getByText('Best')).toBeInTheDocument();
  });

  it('never presents a Best badge when no algorithm produced metrics', async () => {
    const stream = streamFrom();
    const start = await goToTrainingStep('Regression');
    fireEvent.click(start);
    await waitFor(() => expect(trainingMock.subscribeProgress).toHaveBeenCalled());
    stream.emit(ALL_FAILED_FRAME);

    // No "Best" badge and no empty metrics table: the real error is shown.
    await waitFor(() => expect(screen.getByText('No valid metrics')).toBeInTheDocument());
    expect(screen.queryByText('Best')).not.toBeInTheDocument();
    expect(screen.getAllByText(/squared/).length).toBeGreaterThan(0);
  });

  it('shows a failed run as an error instead of an empty table', async () => {
    const stream = streamFrom();
    const start = await goToTrainingStep('Regression');
    fireEvent.click(start);
    await waitFor(() => expect(trainingMock.subscribeProgress).toHaveBeenCalled());

    stream.emit({
      status: 'failed', progress: 40, current_step: 'failed', task_type: 'regression',
      message: "RuntimeError: No models trained successfully (3 of 3 failed). Ridge: TypeError: got an unexpected keyword argument 'squared'",
      error: "RuntimeError: No models trained successfully (3 of 3 failed). Ridge: TypeError: got an unexpected keyword argument 'squared'",
      logs: [], metrics_history: [], all_results: [],
    });

    // The real backend reason reaches the UI instead of an empty table.
    await waitFor(() =>
      expect(screen.getAllByText(/No models trained successfully/i).length).toBeGreaterThan(0),
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('surfaces one failed algorithm without wiping the successful ones', async () => {
    const stream = streamFrom();
    const start = await goToTrainingStep('Regression');
    fireEvent.click(start);
    await waitFor(() => expect(trainingMock.subscribeProgress).toHaveBeenCalled());

    stream.emit({
      ...REGRESSION_FRAME,
      failed_count: 1,
      best_model: { name: 'KNN', status: 'success', metrics: { r2: 0.85 }, cv_score: 0.8747 },
      all_results: [
        REGRESSION_FRAME.all_results[0],
        REGRESSION_FRAME.all_results[2],
        { name: 'DecisionTree', status: 'error', error: 'ValueError: could not convert string to float', metrics: null, cv_score: null, training_time: null },
      ],
    });

    const table = await screen.findByRole('table');
    // Successful models keep their real numbers (CV is shown as a percentage).
    expect(rowFor(table, 'KNN').textContent).toContain('0.8500');
    expect(rowFor(table, 'Ridge').textContent).toContain('3.1%');
    // The failure is visible with its reason, and gets no "Best".
    expect(rowFor(table, 'DecisionTree').textContent).toContain('could not convert string to float');
    expect(within(rowFor(table, 'DecisionTree')).queryByText('Best')).not.toBeInTheDocument();
    // And the winner is still computed from the rows that succeeded.
    expect(within(rowFor(table, 'KNN')).getByText('Best')).toBeInTheDocument();
  });

  it('does not leak the SSE subscription and clears stale results on re-run', async () => {
    const unsubs = [vi.fn(), vi.fn()];
    let call = 0;
    let emit: (f: any) => void = () => {};
    trainingMock.subscribeProgress.mockImplementation((_id: string, cb: (f: any) => void) => {
      emit = (frame: any) => cb(normalizeProgress(frame));
      return unsubs[call++] ?? vi.fn();
    });

    const start = await goToTrainingStep('Regression');
    fireEvent.click(start);
    await waitFor(() => expect(trainingMock.subscribeProgress).toHaveBeenCalledTimes(1));
    emit(REGRESSION_FRAME);
    await screen.findByRole('table');

    // Start a second run from the Hyperparameters step: the previous stream is
    // closed and the old numbers cannot linger on the Results step.
    fireEvent.click(screen.getByRole('button', { name: /Hyperparameters/ }));
    fireEvent.click(screen.getByText(/Start Training/));
    await waitFor(() => expect(unsubs[0]).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
  });

  it('reports the API error instead of rendering an empty metrics table', async () => {
    trainingMock.runWorkflow.mockRejectedValue(new Error('Request failed (500)'));
    const start = await goToTrainingStep('Regression');
    fireEvent.click(start);

    await waitFor(() => expect(screen.getAllByText(/Request failed \(500\)/).length).toBeGreaterThan(0));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(trainingMock.subscribeProgress).not.toHaveBeenCalled();
  });
});
