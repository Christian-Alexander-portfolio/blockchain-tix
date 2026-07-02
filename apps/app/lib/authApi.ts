import { apiRequest } from './api';
import type { AuthResponse, ApiUser } from '@blockchain-tickets/shared';

export const authApi = {
  register: (body: { email: string; password: string; name: string }) =>
    apiRequest<AuthResponse>('/api/auth/register', { method: 'POST', body }),

  login: (body: { email: string; password: string }) =>
    apiRequest<AuthResponse>('/api/auth/login', { method: 'POST', body }),

  me: () => apiRequest<ApiUser>('/api/auth/me'),

  logout: () => apiRequest<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),

  googleSignIn: (idToken: string, name?: string) =>
    apiRequest<AuthResponse>('/api/auth/google', { method: 'POST', body: { idToken, name } }),
};
