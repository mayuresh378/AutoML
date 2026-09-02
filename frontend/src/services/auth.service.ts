import { http } from './http';
import type { AuthResponse, AuthSession, User } from '../types/api';

export const authService = {
  login: (email: string, password: string, device_info?: string) => {
    const form = new FormData();
    form.append('email', email);
    form.append('password', password);
    if (device_info) form.append('device_info', device_info);
    return http.post<AuthResponse>('/auth/login', form);
  },

  register: (email: string, password: string, name: string) => {
    const form = new FormData();
    form.append('email', email);
    form.append('password', password);
    form.append('name', name);
    return http.post<AuthResponse>('/auth/register', form);
  },

  me: () => http.get<User>('/auth/me'),

  refresh: (token: string) => {
    const form = new FormData();
    form.append('token', token);
    return http.post<{ token: string; refresh_token: string }>('/auth/refresh', form);
  },

  updateProfile: (data: { name?: string; preferences?: string }) => {
    const form = new FormData();
    if (data.name) form.append('name', data.name);
    if (data.preferences) form.append('preferences', data.preferences);
    return http.put<User>('/auth/profile', form);
  },

  changePassword: (current_password: string, new_password: string) => {
    const form = new FormData();
    form.append('current_password', current_password);
    form.append('new_password', new_password);
    return http.post<{ message: string }>('/auth/change-password', form);
  },

  sendVerification: () => http.post<{ message: string }>('/auth/send-verification'),

  verifyEmail: (token: string) => {
    const form = new FormData();
    form.append('token', token);
    return http.post<{ message: string }>('/auth/verify-email', form);
  },

  forgotPassword: (email: string) => {
    const form = new FormData();
    form.append('email', email);
    return http.post<{ message: string }>('/auth/forgot-password', form);
  },

  resetPassword: (token: string, new_password: string) => {
    const form = new FormData();
    form.append('token', token);
    form.append('new_password', new_password);
    return http.post<{ message: string }>('/auth/reset-password', form);
  },

  googleLogin: (id_token: string) => {
    const form = new FormData();
    form.append('id_token', id_token);
    return http.post<AuthResponse>('/auth/google', form);
  },

  sessions: () => http.get<{ sessions: AuthSession[] }>('/auth/sessions'),

  revokeSession: (id: string) => http.delete(`/auth/sessions/${id}`),

  logout: () => http.post('/auth/logout').catch(() => {}),

  logoutAll: () => http.post('/auth/logout-all'),
};
