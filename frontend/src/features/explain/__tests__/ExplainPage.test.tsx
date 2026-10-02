import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from '../../../services/http';
import ExplainPage from '../pages/ExplainPage';

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_t, tag) => {
        const name = typeof tag === 'string' ? tag : 'div';
        return ({ children, ...props }: any) => {
          const { animate, initial, exit, transition, layoutId, ...rest } = props;
          return React.createElement(name, rest, children);
        };
      },
    },
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('recharts', () => {
  const Stub = ({ children }: any) => <div data-testid="recharts">{children}</div>;
  return {
    ResponsiveContainer: Stub,
    BarChart: Stub,
    AreaChart: Stub,
    LineChart: Stub,
    ScatterChart: Stub,
    Bar: () => null,
    Area: () => null,
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

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../../../services/http', () => ({
  http: { get: (...args: any[]) => getMock(...args) },
  getErrorMessage: (e: any) => e?.message || 'Request failed',
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ExplainPage />
    </QueryClientProvider>,
  );
}

const datasetsResponse = { datasets: [] };

beforeEach(() => {
  getMock.mockReset();
});

describe('ExplainPage model dropdown', () => {
  it('lists every usable model, including staged and status-less ones', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/models') {
        return Promise.resolve({
          models: [
            { name: 'ready_model.pkl', status: 'ready', task_type: 'classification' },
            { name: 'staged_model.pkl', status: 'staging', task_type: 'regression' },
            { name: 'no_status.pkl', task_type: 'classification' },
            { name: 'archived_model.pkl', status: 'archived' },
            { name: 'failed_model.pkl', status: 'failed' },
          ],
        });
      }
      return Promise.resolve(datasetsResponse);
    });

    renderPage();

    const modelOptions = async () => {
      const select = (await screen.findByLabelText('Model')) as HTMLSelectElement;
      return Array.from(select.options).map((o) => o.value);
    };

    await waitFor(async () => {
      const values = await modelOptions();
      expect(values).toContain('ready_model.pkl');
    });

    const values = await modelOptions();
    expect(values).toContain('staged_model.pkl');
    expect(values).toContain('no_status.pkl');
    expect(values).not.toContain('archived_model.pkl');
    expect(values).not.toContain('failed_model.pkl');
  });

  it('renders filesystem models that the API returns without a status field', async () => {
    getMock.mockImplementation((url: string) =>
      url === '/models'
        ? Promise.resolve({
            models: [
              {
                name: 'engine_classification_RandomForest.pkl',
                task_type: 'classification',
                size_kb: 812.4,
                cv_score: 0.97,
              },
            ],
          })
        : Promise.resolve(datasetsResponse),
    );

    renderPage();

    await waitFor(() =>
      expect(
        Array.from((screen.getByLabelText('Model') as HTMLSelectElement).options).map((o) => o.value),
      ).toContain('engine_classification_RandomForest.pkl'),
    );
    expect(screen.getByText(/engine_classification_RandomForest\.pkl \(classification\)/)).toBeTruthy();
  });

  it('shows the failure reason instead of a silently empty dropdown', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/models') return Promise.reject(new Error('Unauthorized'));
      return Promise.resolve(datasetsResponse);
    });

    renderPage();

    await waitFor(() =>
      expect((screen.getByLabelText('Model') as HTMLSelectElement).options[0].textContent).toBe(
        'Could not load models',
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Unauthorized');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('explains an empty model list rather than offering a blank select', async () => {
    getMock.mockImplementation((url: string) =>
      url === '/models' ? Promise.resolve({ models: [] }) : Promise.resolve(datasetsResponse),
    );

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/No models available\. Train a model first/)).toBeTruthy(),
    );
  });
});
