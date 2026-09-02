import { http } from './http';
import type { Project } from '../types/api';

export type ProjectProblemType = 'classification' | 'regression' | 'time_series' | 'clustering';
export type ProjectVisibility = 'private' | 'team';

export interface CreateProjectInput {
  name: string;
  description?: string;
  problem_type?: ProjectProblemType;
  visibility?: ProjectVisibility;
  tags?: string[];
}

export const projectsService = {
  list: () => http.get<{ projects: Project[] }>('/projects'),

  mine: () => http.get<{ projects: Project[] }>('/projects/mine'),

  get: (id: string) => http.get<Project>(`/projects/${id}`),

  create: (input: CreateProjectInput) => {
    const form = new FormData();
    form.append('name', input.name);
    if (input.description) form.append('description', input.description);
    if (input.problem_type) form.append('problem_type', input.problem_type);
    if (input.visibility) form.append('visibility', input.visibility);
    if (input.tags && input.tags.length) form.append('tags', JSON.stringify(input.tags));
    return http.post<Project>('/projects', form);
  },

  duplicate: (id: string) => http.post<Project>(`/projects/${id}/duplicate`),

  update: (id: string, data: { name?: string; description?: string; status?: string; problem_type?: string; visibility?: string; tags?: string[] }) => {
    const form = new FormData();
    if (data.name !== undefined) form.append('name', data.name);
    if (data.description !== undefined) form.append('description', data.description);
    if (data.status !== undefined) form.append('status', data.status);
    if (data.problem_type !== undefined) form.append('problem_type', data.problem_type);
    if (data.visibility !== undefined) form.append('visibility', data.visibility);
    if (data.tags !== undefined) form.append('tags', JSON.stringify(data.tags));
    return http.put<Project>(`/projects/${id}`, form);
  },

  remove: (id: string) => http.delete(`/projects/${id}`),

  updateNotes: (id: string, notes: string) => {
    const form = new FormData();
    form.append('notes', notes);
    return http.put<Project>(`/projects/${id}/notes`, form);
  },

  templates: () => http.get<{ templates: Project[] }>('/projects/templates'),
};
