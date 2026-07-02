import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ApiUser } from '@blockchain-tickets/shared';

const ACCESS_TOKEN_KEY = 'bt_access_token';
const REFRESH_TOKEN_KEY = 'bt_refresh_token';

async function storeItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

interface AuthState {
  user: ApiUser | null;
  accessToken: string | null;
  isLoaded: boolean;
  setAuth: (user: ApiUser, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStorage: () => Promise<string | null>;
  getAccessToken: () => string | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoaded: false,

  setAuth: async (user, accessToken, refreshToken) => {
    await storeItem(ACCESS_TOKEN_KEY, accessToken);
    await storeItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ user, accessToken });
  },

  clearAuth: async () => {
    await removeItem(ACCESS_TOKEN_KEY);
    await removeItem(REFRESH_TOKEN_KEY);
    set({ user: null, accessToken: null });
  },

  loadFromStorage: async () => {
    const refreshToken = await getItem(REFRESH_TOKEN_KEY);
    set({ isLoaded: true });
    return refreshToken;
  },

  getAccessToken: () => get().accessToken,
}));
