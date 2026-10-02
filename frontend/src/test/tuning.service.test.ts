import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tuningService } from '../services/tuning.service';

const fetchMock = vi.fn();
const listeners = new Map<string, Function[]>();
let controller: AbortController | null = null;

vi.stubGlobal('fetch', (url: RequestInfo | URL, init?: RequestInit) => fetchMock(String(url), init));

beforeEach(() => {
  fetchMock.mockReset();
  listeners.clear();
  controller = new AbortController();

  // HTTP layer plumbing used by every request helper.
  const response = (body: any, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });

  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/hpo/experiments/')) {
      if (url.endsWith('/rerun')) {
        return Promise.resolve(response({ job_id: 'jobR', status: 'queued', rerun_of: 'expA' }));
      }
      // Delete path
      if (init?.method === 'DELETE') {
        return Promise.resolve(response({ status: 'deleted', id: 'expA' }));
      }
      // Detail path
      return Promise.resolve(response({ id: 'expA', status: 'completed', config: { method: 'grid' } }));
    }
    if (url.endsWith('/hpo/experiments')) {
      return Promise.resolve(response({
        experiments: [{ id: 'expA' }, { id: 'expB' }],
        total: 2,
        offset: 0,
        limit: 50,
      }));
    }
    return Promise.resolve(response({}));
  });
});

describe('tuningService history API', () => {
  it('lists experiments', async () => {
    const res = await tuningService.experiments();
    expect(res.total).toBe(2);
    expect(res.experiments).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/hpo/experiments', expect.any(Object));
  });

  it('fetches a single experiment detail', async () => {
    const res = await tuningService.experimentDetail('expA');
    expect(res.id).toBe('expA');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/hpo/experiments/expA', expect.any(Object));
  });

  it('re-runs an experiment without a JSON body', async () => {
    const res = await tuningService.rerunExperiment('expA');
    expect(res.job_id).toBe('jobR');
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    const entry = calls.find((c) => c[0] === '/api/v1/hpo/experiments/expA/rerun')!;
    expect(entry[1].method).toBe('POST');
    expect(entry[1].body).toBeUndefined();
  });

  it('deletes an experiment', async () => {
    const res = await tuningService.deleteExperiment('expA');
    expect(res.status).toBe('deleted');
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    const entry = calls.find((c) => c[0] === '/api/v1/hpo/experiments/expA')!;
    expect(entry[1].method).toBe('DELETE');
  });
});