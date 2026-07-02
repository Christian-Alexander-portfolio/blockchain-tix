import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';

// In dev: use your machine's local IP so physical devices can reach it
// In production: Railway URL
const BASE_URL = __DEV__
  ? Platform.OS === 'web'
    ? 'http://localhost:3000'
    : 'http://10.0.2.2:3000' // Android emulator → host machine
  : process.env.EXPO_PUBLIC_API_URL ?? 'https://your-api.railway.app';

export const API_BASE = BASE_URL;

async function refreshAccessToken(): Promise<string | null> {
  const { loadFromStorage, setAuth, clearAuth } = useAuthStore.getState();
  const refreshToken = await loadFromStorage();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await clearAuth();
      return null;
    }
    const data = await res.json();
    await setAuth(data.user, data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    await clearAuth();
    return null;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  isMultipart?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, isMultipart = false } = options;
  const { accessToken } = useAuthStore.getState();

  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (body && !isMultipart) headers['Content-Type'] = 'application/json';

  const makeRequest = async (token: string | null) => {
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: isMultipart ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    });
  };

  let res = await makeRequest(accessToken);

  // Auto-refresh on 401
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await makeRequest(newToken);
    } else {
      throw new ApiError(401, 'Session expired. Please log in again.');
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(res.status, data.error ?? 'Request failed');
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
