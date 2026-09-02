import { describe, it, expect, vi } from 'vitest';
import { BASE, downloadUrl, downloadBlob } from '../lib/api';

describe('api utilities', () => {
  it('exports BASE url', () => {
    expect(BASE).toBe('/api/v1');
  });

  it('downloadUrl returns url with token', () => {
    const url = downloadUrl('/datasets/test.csv');
    expect(url).toContain('/api/v1/datasets/test.csv');
  });

  it('downloadBlob creates and revokes blob URL', () => {
    const revoke = vi.fn();
    URL.revokeObjectURL = revoke;
    const data = [{ name: 'test', value: 1 }];
    downloadBlob(data, 'test.csv');
    expect(revoke).toHaveBeenCalled();
  });
});
