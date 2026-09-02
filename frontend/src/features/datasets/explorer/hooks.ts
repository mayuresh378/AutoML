import { useQuery } from '@tanstack/react-query';
import { datasetsService } from '../../../services/datasets.service';
import type { DatasetAnalysisResult, DatasetMeta, DatasetPreview, DatasetProfile } from './types';

export function useExplorerDatasets() {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list() as unknown as Promise<{ datasets: DatasetMeta[] }>,
    select: (d) => d.datasets,
    staleTime: 30_000,
  });
}

export function useExplorerAnalyze(name: string) {
  return useQuery({
    queryKey: ['dataset', name, 'analysis'],
    queryFn: () => datasetsService.analyze(name) as unknown as Promise<DatasetAnalysisResult>,
    enabled: !!name,
    staleTime: 60_000,
  });
}

export function useExplorerProfile(name: string) {
  return useQuery({
    queryKey: ['dataset', name, 'profile'],
    queryFn: () => datasetsService.profile(name) as unknown as Promise<DatasetProfile>,
    enabled: !!name,
    staleTime: 60_000,
  });
}

export function useExplorerPreview(name: string, rows: number, offset: number) {
  return useQuery({
    queryKey: ['dataset', name, 'preview', rows, offset],
    queryFn: () => datasetsService.preview(name, rows, offset) as unknown as Promise<DatasetPreview>,
    enabled: !!name,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}
