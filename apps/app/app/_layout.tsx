import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/authApi';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoaded, loadFromStorage, setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    async function bootstrap() {
      const refreshToken = await loadFromStorage();
      if (refreshToken) {
        try {
          const res = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/auth/refresh`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            },
          );
          if (res.ok) {
            const data = await res.json();
            await setAuth(data.user, data.accessToken, data.refreshToken);
            return;
          }
        } catch {}
      }
      await clearAuth();
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isLoaded, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AuthGate />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
