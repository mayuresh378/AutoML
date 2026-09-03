/**
 * Legacy hooks module — delegates to the new hooks/services layer.
 * Prefer importing from the new hooks or services directly.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { datasetsService } from '../services/datasets.service';
import { trainingService } from '../services/training.service';
import { experimentsService } from '../services/experiments.service';
import { modelsService } from '../services/models.service';
import { deploymentsService } from '../services/deployments.service';
import { projectsService } from '../services/projects.service';
import { pipelinesService } from '../services/pipelines.service';
import { webhooksService } from '../services/webhooks.service';
import { monitoringService } from '../services/monitoring.service';
import { activityService } from '../services/activity.service';
import { searchService } from '../services/search.service';
import { marketplaceService } from '../services/marketplace.service';
import { apiKeysService } from '../services/apiKeys.service';
import { teamsService } from '../services/teams.service';
import { aiService } from '../services/ai.service';
import { notificationsService } from '../services/notifications.service';
import { http } from '../services/http';

export function useExperiments() {
  return useQuery({
    queryKey: ['experiments'],
    queryFn: () => experimentsService.list(),
    select: (data) => data.experiments,
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function useModels() {
  return useQuery({
    queryKey: ['models'],
    queryFn: () => modelsService.list(),
    select: (data) => data.models,
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function usePromoteModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => modelsService.promote(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }),
  });
}

export function useArchiveModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => modelsService.archive(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }),
  });
}

export function useDeleteModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => modelsService.remove(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }),
  });
}

export function useUpdateModelTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, tags }: { name: string; tags: string[] }) => modelsService.updateTags(name, tags),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }),
  });
}

export function useDeployments() {
  return useQuery({
    queryKey: ['deployments'],
    queryFn: () => deploymentsService.list(),
    select: (data) => data.deployments,
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function useCreateDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ model_name, endpoint_name }: { model_name: string; endpoint_name: string }) =>
      deploymentsService.create(model_name, endpoint_name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  });
}

export function useDeleteDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dep_id: string) => deploymentsService.remove(dep_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  });
}

export function useDeploymentDetail(id: string | null) {
  return useQuery({
    queryKey: ['deployments', id],
    queryFn: () => deploymentsService.get(id!),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useDeploymentHistory(id: string | null) {
  return useQuery({
    queryKey: ['deployments', id, 'history'],
    queryFn: () => deploymentsService.history(id!),
    select: (data) => data.history,
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useUpdateDeploymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => deploymentsService.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deployments'] }); },
  });
}

export function useUpdateDeploymentAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; allow_anonymous?: boolean; api_key_required?: boolean; rate_limit?: number | null; allowed_users?: string[]; allowed_ips?: string[] }) =>
      deploymentsService.updateAccess(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deployments'] }); },
  });
}

export function useDatasets() {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
    select: (data) => data.datasets,
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function useDatasetPreview(name: string, rows = 50, offset = 0) {
  return useQuery({
    queryKey: ['dataset', name, 'preview', rows, offset],
    queryFn: () => datasetsService.preview(name, rows, offset),
    enabled: !!name,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useDatasetProfile(name: string) {
  return useQuery({
    queryKey: ['dataset', name, 'profile'],
    queryFn: () => datasetsService.profile(name),
    enabled: !!name,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useDatasetAnalysis(name: string, target?: string) {
  return useQuery({
    queryKey: ['dataset', name, 'analysis', target],
    queryFn: () => datasetsService.analyze(name, target),
    enabled: !!name,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
    select: (data) => data.projects,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsService.get(id),
    enabled: !!id,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      projectsService.create({ name, description }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; status?: string }) =>
      projectsService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => searchService.search(q),
    enabled: q.length >= 2,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function usePipelines() {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: () => pipelinesService.list(),
    select: (data) => data.pipelines,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function usePipeline(id: string) {
  return useQuery({
    queryKey: ['pipeline', id],
    queryFn: () => pipelinesService.get(id),
    enabled: !!id,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, steps, description }: { name: string; steps: any[]; description?: string }) =>
      pipelinesService.create(name, steps, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pipelinesService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}

export function useRunPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pipeline_id: string) => pipelinesService.run(pipeline_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-runs'] }),
  });
}

export function usePipelineRuns(pipeline_id: string) {
  return useQuery({
    queryKey: ['pipeline-runs', pipeline_id],
    queryFn: () => pipelinesService.runs(pipeline_id),
    select: (data) => data.runs,
    enabled: !!pipeline_id,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: () => webhooksService.list(),
    select: (data) => data.webhooks,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; url: string; events: string[] }) => webhooksService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => webhooksService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysService.list(),
    select: (data) => data.api_keys,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiKeysService.create(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiKeysService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsService.list(),
    select: (data) => data.teams,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => teamsService.create(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useMarketplaceItems(category?: string) {
  return useQuery({
    queryKey: ['marketplace', category],
    queryFn: () => marketplaceService.list(category),
    select: (data) => data.items,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useInstallMarketplaceItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item_id: string) => marketplaceService.install(item_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace'] }),
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: () => activityService.list(),
    select: (data) => data.activities,
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function useMonitoringMetrics() {
  return useQuery({
    queryKey: ['monitoring', 'metrics'],
    queryFn: () => monitoringService.metrics(),
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function useMonitoringStats() {
  return useQuery({
    queryKey: ['monitoring', 'stats'],
    queryFn: () => monitoringService.stats(),
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function useMonitoringDashboard() {
  return useQuery({
    queryKey: ['monitoring', 'dashboard'],
    queryFn: () => monitoringService.dashboard(),
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function useAISuggestions() {
  return useQuery({
    queryKey: ['ai', 'suggestions'],
    queryFn: () => aiService.suggestions(),
    select: (data) => data.suggestions,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsService.list(),
    select: (data) => data.notifications,
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsService.unreadCount(),
    select: (data) => data.count,
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

export function useTrainingQueue() {
  return useQuery({
    queryKey: ['training', 'queue'],
    queryFn: () => trainingService.queue(),
    select: (data) => data.jobs,
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => http.get<{ status: string; message?: string; data?: Record<string, any> }>('/health'),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useDashboardData() {
  const experiments = useExperiments();
  const models = useModels();
  const datasets = useDatasets();
  const deployments = useDeployments();
  const activity = useActivity();
  const monitoringStats = useMonitoringStats();
  const monitoringDashboard = useMonitoringDashboard();
  const trainingQueue = useTrainingQueue();
  const notifications = useNotifications();
  const unreadCount = useUnreadNotificationCount();
  const aiSuggestions = useAISuggestions();
  const healthCheck = useHealthCheck();

  return {
    experiments: experiments.data ?? [],
    models: models.data ?? [],
    datasets: datasets.data ?? [],
    deployments: deployments.data ?? [],
    activity: activity.data ?? [],
    monitoringStats: monitoringStats.data ?? null,
    monitoringDashboard: monitoringDashboard.data ?? null,
    trainingQueue: trainingQueue.data ?? [],
    notifications: notifications.data ?? [],
    unreadCount: unreadCount.data ?? 0,
    aiSuggestions: aiSuggestions.data ?? [],
    healthCheck: healthCheck.data ?? null,
    isLoading: experiments.isLoading || models.isLoading || datasets.isLoading || deployments.isLoading || activity.isLoading,
    isError: experiments.isError || models.isError || datasets.isError || deployments.isError || activity.isError,
    error: experiments.error || models.error || datasets.error || deployments.error || activity.error,
    isFetching: experiments.isFetching || models.isFetching || datasets.isFetching || deployments.isFetching || activity.isFetching || monitoringStats.isFetching || monitoringDashboard.isFetching,
    lastUpdated: new Date(),
  };
}
