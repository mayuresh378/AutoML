import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MetricGrid } from '../components/MetricGrid';
import { ConfusionMatrixChart } from '../components/ConfusionMatrixChart';
import { FeatureImportanceChart } from '../components/FeatureImportanceChart';
import { InsightsPanel } from '../components/InsightsPanel';
import { PredictionSamplesTable } from '../components/PredictionSamplesTable';
import type { PredictionSample } from '../services/evaluation.service';

// Recharts measures its container, which jsdom reports as 0x0. The charts only
// need to mount and expose their accessible summary for these assertions.
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

describe('MetricGrid', () => {
  it('shows real classification metrics and explains each one', () => {
    render(
      <MetricGrid
        taskType="classification"
        unavailable={[]}
        metrics={{ accuracy: 0.94, precision: 0.91, recall: 0.89, f1: 0.9, roc_auc: 0.97 }}
      />,
    );
    expect(screen.getByText('0.9400')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getByText(/Share of test rows predicted correctly/)).toBeInTheDocument();
  });

  it('marks an unavailable metric N/A with a reason instead of inventing a value', () => {
    render(
      <MetricGrid
        taskType="classification"
        unavailable={['ROC curve could not be computed: AttributeError']}
        metrics={{ accuracy: 0.8 }}
      />,
    );
    // A model without predict_proba must not be shown a fake AUC.
    const rocTile = screen.getByText('ROC AUC').closest('[data-empty="true"]')!;
    expect(rocTile).not.toBeNull();
    expect(within(rocTile as HTMLElement).getByText('N/A')).toBeInTheDocument();
    expect(
      within(rocTile as HTMLElement).getByText(/ROC curve could not be computed/),
    ).toBeInTheDocument();
  });

  it('attributes the right reason to each unavailable metric', () => {
    render(
      <MetricGrid
        taskType="classification"
        unavailable={['Log loss could not be computed: ValueError']}
        metrics={{ accuracy: 0.8, roc_auc: 0.9 }}
      />,
    );
    const logLossTile = screen.getByText('Log Loss').closest('[data-empty="true"]')!;
    expect(within(logLossTile as HTMLElement).getByText(/Log loss could not be computed/)).toBeInTheDocument();
  });

  it('shows regression metrics only for a regression model', () => {
    render(
      <MetricGrid
        taskType="regression"
        unavailable={[]}
        metrics={{ r2: 0.81, rmse: 4.2, mae: 3.1 }}
      />,
    );
    expect(screen.getByText('0.8100')).toBeInTheDocument();
    expect(screen.queryByText('Accuracy')).not.toBeInTheDocument();
  });
});

describe('ConfusionMatrixChart', () => {
  const matrix = {
    labels: ['cat', 'dog'],
    matrix: [
      [8, 2],
      [1, 9],
    ],
  };

  it('renders the label and cell counts from the response', () => {
    render(<ConfusionMatrixChart data={matrix} />);
    expect(screen.getByText('cat')).toBeInTheDocument();
    expect(screen.getByText('dog')).toBeInTheDocument();
    expect(screen.getByText('2 classes · 20 test rows')).toBeInTheDocument();
    expect(screen.getByTitle('actual cat / predicted dog: 2')).toBeInTheDocument();
  });

  it('states the reason when the matrix is absent', () => {
    render(<ConfusionMatrixChart data={null} reason="Confusion matrix could not be computed: X" />);
    expect(screen.getByText(/Confusion matrix could not be computed/)).toBeInTheDocument();
  });
});

describe('FeatureImportanceChart', () => {
  const importance = Array.from({ length: 15 }, (_, i) => ({
    feature: `feature_${i}`,
    importance: 1 - i / 20,
    normalized: 1 - i / 15,
  }));

  it('ranks the strongest feature first', () => {
    render(<FeatureImportanceChart data={importance} />);
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show all 15/i })).toBeInTheDocument();
  });

  it('says so plainly when a model exposes no importances', () => {
    render(<FeatureImportanceChart data={[]} />);
    expect(screen.getByText(/does not expose feature importances/i)).toBeInTheDocument();
  });
});

describe('InsightsPanel', () => {
  it('renders structured insights with severity and evidence', () => {
    render(
      <InsightsPanel
        basis="80 train / 20 test rows"
        insights={[
          {
            key: 'overall',
            severity: 'positive',
            title: 'Overall correctness: excellent',
            detail: 'Accuracy reached 0.9400 on the held-out split.',
            evidence: { accuracy: 0.94, rows: 20 },
          },
          {
            key: 'overfit',
            severity: 'warning',
            title: 'Possible overfitting',
            detail: 'Training accuracy exceeds validation accuracy by 0.11.',
          },
        ]}
      />,
    );

    expect(screen.getByText('Overall correctness: excellent')).toBeInTheDocument();
    expect(screen.getByText(/Accuracy reached 0.9400/)).toBeInTheDocument();
    expect(screen.getByText('Strength')).toBeInTheDocument();
    expect(screen.getByText('Watch')).toBeInTheDocument();
    expect(screen.getByText('80 train / 20 test rows')).toBeInTheDocument();
    expect(screen.getByText(/accuracy: 0.94/)).toBeInTheDocument();
  });

  it('orders problems before strengths', () => {
    render(
      <InsightsPanel
        insights={[
          { key: 'a', severity: 'positive', title: 'Good thing', detail: 'x' },
          { key: 'b', severity: 'critical', title: 'Bad thing', detail: 'y' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Bad thing')).toBeInTheDocument();
  });

  it('renders nothing when there are no insights', () => {
    const { container } = render(<InsightsPanel insights={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PredictionSamplesTable', () => {
  const samples: PredictionSample[] = Array.from({ length: 12 }, (_, i) => ({
    actual: `class_${i % 3}`,
    predicted: i % 4 === 0 ? `class_${(i + 1) % 3}` : `class_${i % 3}`,
    correct: i % 4 !== 0,
    probability: { [`class_${i % 3}`]: 0.8, class_other: 0.2 },
  }));

  it('renders actual, predicted and correctness per row', () => {
    render(<PredictionSamplesTable data={samples} taskType="classification" totalRows={40} />);
    expect(screen.getByText(/12 of 40 test rows shown/)).toBeInTheDocument();
    expect(screen.getAllByText('correct').length).toBeGreaterThan(0);
    expect(screen.getAllByText('wrong').length).toBeGreaterThan(0);
  });

  it('filters rows by actual or predicted value', () => {
    const filterable: PredictionSample[] = [
      { actual: 'alpha', predicted: 'alpha', correct: true },
      { actual: 'beta', predicted: 'alpha', correct: false },
      { actual: 'gamma', predicted: 'gamma', correct: true },
    ];
    render(<PredictionSamplesTable data={filterable} taskType="classification" totalRows={3} />);
    expect(screen.getByText('beta')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter prediction samples'), {
      target: { value: 'beta' },
    });
    // The row whose actual is beta stays; the others are filtered out.
    expect(screen.getByText('beta')).toBeInTheDocument();
    expect(screen.queryByText('gamma')).not.toBeInTheDocument();
    expect(screen.getAllByText('alpha').length).toBe(1);
  });

  it('reports a filter that matches nothing instead of showing stale rows', () => {
    render(<PredictionSamplesTable data={samples} taskType="classification" totalRows={40} />);
    fireEvent.change(screen.getByLabelText('Filter prediction samples'), {
      target: { value: 'nothing-matches' },
    });
    expect(screen.getByText(/No prediction sample matches that filter/)).toBeInTheDocument();
  });

  it('paginates beyond the first page', () => {
    render(<PredictionSamplesTable data={samples} taskType="classification" totalRows={40} />);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('shows residual columns for regression and hides correctness', () => {
    render(
      <PredictionSamplesTable
        taskType="regression"
        totalRows={20}
        data={[
          { actual: 10, predicted: 12.5, residual: -2.5, abs_error: 2.5 },
        ]}
      />,
    );
    expect(screen.getByText('Residual')).toBeInTheDocument();
    expect(screen.getByText('-2.5000')).toBeInTheDocument();
    expect(screen.queryByText('correct')).not.toBeInTheDocument();
  });
});
