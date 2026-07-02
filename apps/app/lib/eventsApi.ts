import { apiRequest } from './api';
import type { ApiEvent, ApiTicketTier } from '@blockchain-tickets/shared';

export const eventsApi = {
  list: (params?: { city?: string; search?: string; page?: number }) => {
    const qs = new URLSearchParams(params as any).toString();
    return apiRequest<{ events: ApiEvent[]; total: number }>(`/api/events${qs ? `?${qs}` : ''}`);
  },

  get: (slug: string) => apiRequest<ApiEvent>(`/api/events/${slug}`),

  create: (body: {
    title: string;
    description: string;
    venue: string;
    address: string;
    city: string;
    country: string;
    startsAt: string;
    endsAt: string;
  }) => apiRequest<ApiEvent>('/api/events', { method: 'POST', body }),

  update: (id: string, body: Partial<ApiEvent>) =>
    apiRequest<ApiEvent>(`/api/events/${id}`, { method: 'PATCH', body }),

  publish: (id: string) =>
    apiRequest<ApiEvent>(`/api/events/${id}/publish`, { method: 'PATCH' }),

  cancel: (id: string) =>
    apiRequest<{ success: boolean }>(`/api/events/${id}`, { method: 'DELETE' }),

  createTier: (eventId: string, body: {
    name: string;
    faceValueCents: number;
    totalSupply: number;
    description?: string;
  }) => apiRequest<ApiTicketTier>(`/api/events/${eventId}/tiers`, { method: 'POST', body }),

  uploadImage: (eventId: string, file: FormData) =>
    apiRequest<{ imageUrl: string }>(`/api/events/${eventId}/image`, {
      method: 'POST',
      body: file,
      isMultipart: true,
    }),
};
