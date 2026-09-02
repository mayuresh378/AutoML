import { http } from './http';
import type { Team } from '../types/api';

export const teamsService = {
  list: () => http.get<{ teams: Team[] }>('/teams'),

  create: (name: string) => {
    const form = new FormData();
    form.append('name', name);
    return http.post<Team>('/teams', form);
  },

  get: (id: string) => http.get<Team>(`/teams/${id}`),

  update: (id: string, data: { name?: string }) =>
    http.put<Team>(`/teams/${id}`, data),

  remove: (id: string) => http.delete(`/teams/${id}`),
};
