import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { evaluationService, type EvaluateRequest, type HistoryParams, type TaskType } from '../services/evaluation.service';

/**
 * Evaluation queries.
 *
 * The selection itself (model, dataset, target) lives in component state, so
 * nothing is fetched until the user actually runs an evaluation. Results are
 * cached by their inputs, which makes switching back to a previous selection
 * instant without another expensive run.
 */
export const evaluationKeys = {
  all: ['evaluation'] as const,
  result: (req: EvaluateRequest) => ['evaluation', 'result', req] as const,
  history: (params: HistoryParams) => ['evaluation', 'history', params] as const,
  detail: (id: string) => ['evaluation', 'detail', id] as const,
};

export function useEvaluationHistory(params: HistoryParams = {}) {
  return useQuery({
    queryKey: evaluationKeys.history(params),
    queryFn: () => evaluationService.history(params),
    staleTime: 30_000,
  });
}

export function useEvaluationDetail(id: string | null) {
  return useQuery({
    queryKey: evaluationKeys.detail(id ?? ''),
    queryFn: () => evaluationService.get(id as string),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
}

export function useRunEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: EvaluateRequest) => evaluationService.evaluate(req),
    onSuccess: (_data, req) => {
      // Cache under the exact inputs so revisiting this selection is instant.
      qc.setQueryData(evaluationKeys.result(req), _data);
      qc.invalidateQueries({ queryKey: ['evaluation', 'history'] });
    },
  });
}

export function useAnalyzeDataset() {
  return useMutation({
    mutationFn: ({ fileName, targetColumn }: { fileName: string; targetColumn?: string }) =>
      evaluationService.analyzeDataset(fileName, targetColumn),
  });
}

export function useRunDatasetEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: { file_name: string; target_column?: string; task_type?: TaskType }) =>
      evaluationService.evaluateDataset(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evaluation', 'history'] });
    },
  });
}

export function useCompareModels() {
  return useMutation({
    mutationFn: ({
      modelNames,
      datasetName,
      targetColumn,
    }: {
      modelNames: string[];
      datasetName: string;
      targetColumn: string;
    }) => evaluationService.compare(modelNames, datasetName, targetColumn),
  });
}

