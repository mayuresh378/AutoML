/**
 * Legacy API module — delegates to the new services/ layer.
 * Prefer importing from 'services/' or individual service modules directly.
 */
export { BASE, downloadUrl, downloadBlob } from '../services/http';

import { http } from '../services/http';
import { authService } from '../services/auth.service';
import { datasetsService } from '../services/datasets.service';
import { trainingService } from '../services/training.service';
import { experimentsService } from '../services/experiments.service';
import { modelsService } from '../services/models.service';
import { deploymentsService } from '../services/deployments.service';
import { predictionsService } from '../services/predictions.service';
import { monitoringService } from '../services/monitoring.service';
import { activityService } from '../services/activity.service';
import { pipelinesService } from '../services/pipelines.service';
import { webhooksService } from '../services/webhooks.service';
import { searchService } from '../services/search.service';
import { projectsService } from '../services/projects.service';
import { marketplaceService } from '../services/marketplace.service';
import { apiKeysService } from '../services/apiKeys.service';
import { teamsService } from '../services/teams.service';
import { aiService } from '../services/ai.service';
import { notificationsService } from '../services/notifications.service';

// Re-export all services with the old `api.*` namespacing
export const api = {
  auth: {
    login: authService.login,
    register: authService.register,
    me: authService.me,
    refresh: authService.refresh,
    updateProfile: authService.updateProfile,
    changePassword: authService.changePassword,
    sendVerification: authService.sendVerification,
    verifyEmail: authService.verifyEmail,
    forgotPassword: authService.forgotPassword,
    resetPassword: authService.resetPassword,
    googleLogin: authService.googleLogin,
    sessions: authService.sessions,
    revokeSession: authService.revokeSession,
    logout: authService.logout,
    logoutAll: authService.logoutAll,
  },
  datasets: datasetsService,
  training: trainingService,
  experiments: experimentsService,
  models: modelsService,
  deployments: deploymentsService,
  predictions: predictionsService,
  monitoring: monitoringService,
  activity: activityService,
  pipelines: pipelinesService,
  webhooks: webhooksService,
  search: (q: string) => searchService.search(q),
  projects: projectsService,
  marketplace: marketplaceService,
  apiKeys: apiKeysService,
  teams: teamsService,
  ai: aiService,
  notifications: notificationsService,
  post: (path: string, data: Record<string, any>) => http.post(path, data),
  get: (path: string) => http.get(path),
};
