import { apiRequest } from './api';
import type { ApiTicket, ApiListing, UsdcPaymentSession } from '@blockchain-tickets/shared';

export const ticketsApi = {
  mine: () => apiRequest<ApiTicket[]>('/api/tickets/mine'),

  getQr: (ticketId: string) =>
    apiRequest<{ qrToken: string; expiresInSeconds: number }>(`/api/tickets/${ticketId}/qr`),

  purchase: (body: {
    tierId: string;
    paymentMethod: 'BRAINTREE_CARD' | 'BRAINTREE_APPLE_PAY' | 'BRAINTREE_GOOGLE_PAY' | 'USDC_POLYGON';
    paymentNonce?: string;
  }) =>
    apiRequest<{ ticket: ApiTicket; txHash: string } | { type: 'USDC_SESSION'; session: UsdcPaymentSession }>(
      '/api/tickets/purchase',
      { method: 'POST', body },
    ),

  listForResale: (ticketId: string, askPriceCents: number) =>
    apiRequest<ApiListing>(`/api/tickets/${ticketId}/list-for-resale`, {
      method: 'POST',
      body: { askPriceCents },
    }),

  cancelListing: (ticketId: string) =>
    apiRequest<{ success: boolean }>(`/api/tickets/${ticketId}/listing`, { method: 'DELETE' }),
};

export const listingsApi = {
  browse: (params?: { eventId?: string; page?: number }) => {
    const qs = new URLSearchParams(params as any).toString();
    return apiRequest<{ listings: ApiListing[]; total: number }>(
      `/api/listings${qs ? `?${qs}` : ''}`,
    );
  },

  get: (listingId: string) => apiRequest<ApiListing>(`/api/listings/${listingId}`),

  buy: (listingId: string, paymentNonce: string) =>
    apiRequest<{ ticket: ApiTicket; txHash: string; orderId: string }>(
      `/api/listings/${listingId}/buy`,
      { method: 'POST', body: { paymentNonce } },
    ),
};

export const paymentsApi = {
  getBraintreeToken: () =>
    apiRequest<{ clientToken: string }>('/api/payments/braintree-token'),

  checkUsdcSession: (sessionId: string) =>
    apiRequest<{ fulfilled: boolean; txHash: string | null }>(
      `/api/payments/usdc-session/${sessionId}/status`,
    ),
};

export const adminApi = {
  getOrganizers: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return apiRequest<any[]>(`/api/admin/organizers${qs}`);
  },
  approveOrganizer: (id: string) =>
    apiRequest<any>(`/api/admin/organizers/${id}/approve`, { method: 'PATCH' }),
  suspendOrganizer: (id: string) =>
    apiRequest<any>(`/api/admin/organizers/${id}/suspend`, { method: 'PATCH' }),
  getSettings: () => apiRequest<any>('/api/admin/settings'),
  updateSettings: (body: any) =>
    apiRequest<any>('/api/admin/settings', { method: 'PATCH', body }),
  getAnalytics: () => apiRequest<any>('/api/admin/analytics'),
  getEvents: () => apiRequest<any>('/api/admin/events'),
  updateUserRole: (userId: string, role: string) =>
    apiRequest<any>(`/api/admin/users/${userId}/role`, { method: 'PATCH', body: { role } }),
};

export const scanApi = {
  verify: (token: string, eventId: string) =>
    apiRequest<any>('/api/scan/verify', { method: 'POST', body: { token, eventId } }),
};
