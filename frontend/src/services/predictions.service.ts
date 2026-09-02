import { http } from './http';

export const predictionsService = {
  run: (model_name: string, payload: Record<string, any>) => {
    const form = new FormData();
    form.append('model_name', model_name);
    form.append('payload', JSON.stringify(payload));
    return http.post<{ prediction: any; confidence?: number }>('/predictions', form);
  },

  batch: (model_name: string, records: Record<string, any>[]) => {
    const form = new FormData();
    form.append('model_name', model_name);
    form.append('records', JSON.stringify(records));
    return http.post<{ predictions: any[] }>('/predictions/batch', form);
  },

  batchFile: (model_name: string, file_name: string) => {
    const form = new FormData();
    form.append('model_name', model_name);
    form.append('file_name', file_name);
    return http.post<{ predictions: any[]; count: number; latency_ms: number }>('/batch-predictions', form);
  },
};
