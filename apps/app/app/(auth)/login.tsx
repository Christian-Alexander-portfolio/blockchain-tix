import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../lib/authApi';
import { apiRequest, ApiError } from '../../lib/api';

// ─── Dev panel (tree-shaken from production builds via __DEV__) ────────────────

const DEV_ACCOUNTS = [
  { label: 'Admin', email: 'mckdunkey@gmail.com', password: 'Password1!', color: '#7C3AED' },
  { label: 'Organizer', email: 'organizer@demo.com', password: 'Demo1234!', color: '#059669' },
  { label: 'Buyer', email: 'buyer@demo.com', password: 'Demo1234!', color: '#2563EB' },
  { label: 'Scanner', email: 'scanner@demo.com', password: 'Demo1234!', color: '#D97706' },
] as const;

function DevPanel() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [expanded, setExpanded] = useState(false);
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [seeding, setSeeding] = useState<'demo' | 'reset' | null>(null);

  async function quickLogin(email: string, password: string, label: string) {
    setLoggingIn(label);
    try {
      const data = await authApi.login({ email, password });
      await setAuth(data.user, data.accessToken, data.refreshToken);
      router.replace('/(tabs)');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      Alert.alert(`Quick login failed (${label})`, msg);
    } finally {
      setLoggingIn(null);
    }
  }

  async function runSeed(mode: 'demo' | 'reset') {
    setSeeding(mode);
    try {
      const result = await apiRequest<{ success: boolean; log: string[] }>(
        '/api/dev/seed',
        { method: 'POST', body: { mode } },
      );
      Alert.alert(
        mode === 'reset' ? '✓ Reset complete' : '✓ Demo data seeded',
        result.log.join('\n'),
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Seed failed';
      if (err instanceof ApiError && err.status === 401) {
        Alert.alert('Not authorised', 'Log in as Admin first, then seed.');
      } else {
        Alert.alert('Seed error', msg);
      }
    } finally {
      setSeeding(null);
    }
  }

  function confirmReset() {
    Alert.alert(
      '⚠️ Reset database',
      'This will DELETE all users, tickets, events, and orders, then re-seed from scratch. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset everything', style: 'destructive', onPress: () => runSeed('reset') },
      ],
    );
  }

  return (
    <View className="mt-8 border-t border-gray-800 pt-4">
      {/* Toggle */}
      <TouchableOpacity
        className="flex-row items-center justify-center gap-1"
        onPress={() => setExpanded((v) => !v)}
      >
        <Text className="text-gray-600 text-xs font-mono">
          DEV TOOLS {expanded ? '▾' : '▸'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View className="mt-3 rounded-xl border border-gray-700 bg-gray-900/60 p-3 gap-3">

          {/* Quick Login */}
          <Text className="text-gray-500 text-xs font-mono uppercase tracking-wider">Quick Login</Text>
          <View className="flex-row flex-wrap gap-2">
            {DEV_ACCOUNTS.map(({ label, email, password, color }) => (
              <TouchableOpacity
                key={label}
                className="rounded-lg px-3 py-2 flex-row items-center gap-1"
                style={{ backgroundColor: `${color}22`, borderWidth: 1, borderColor: `${color}55` }}
                onPress={() => quickLogin(email, password, label)}
                disabled={loggingIn !== null}
              >
                {loggingIn === label ? (
                  <ActivityIndicator size="small" color={color} />
                ) : (
                  <Text style={{ color }} className="text-xs font-semibold">
                    {label}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Account details hint */}
          <View className="rounded-lg bg-gray-800 px-3 py-2 gap-0.5">
            {DEV_ACCOUNTS.map(({ label, email, password }) => (
              <Text key={label} className="text-gray-500 text-xs font-mono">
                {label.padEnd(10)} {email} / {password}
              </Text>
            ))}
          </View>

          {/* Seed Database */}
          <Text className="text-gray-500 text-xs font-mono uppercase tracking-wider mt-1">
            Seed Database
          </Text>
          <Text className="text-gray-600 text-xs -mt-2">
            Requires being logged in as Admin
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="flex-1 rounded-lg border border-blue-800 bg-blue-900/20 py-2 items-center"
              onPress={() => runSeed('demo')}
              disabled={seeding !== null}
            >
              {seeding === 'demo' ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <Text className="text-blue-400 text-xs font-semibold">Seed Demo Data</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 rounded-lg border border-red-800 bg-red-900/20 py-2 items-center"
              onPress={confirmReset}
              disabled={seeding !== null}
            >
              {seeding === 'reset' ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Text className="text-red-400 text-xs font-semibold">Reset + Re-seed</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main login screen ─────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.login({ email, password });
      await setAuth(data.user, data.accessToken, data.refreshToken);
      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-dark"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6 py-12">
          {/* Logo / Brand */}
          <View className="mb-10 items-center">
            <Text className="text-4xl font-bold text-white">🎟️</Text>
            <Text className="mt-2 text-3xl font-bold text-white">BlockchainTickets</Text>
            <Text className="mt-1 text-gray-400 text-sm">Verified. Secure. Yours.</Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <View>
              <Text className="mb-1 text-gray-300 text-sm font-medium">Email</Text>
              <TextInput
                className="rounded-xl bg-surface px-4 py-3 text-white text-base"
                placeholder="you@example.com"
                placeholderTextColor="#6B7280"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View>
              <Text className="mb-1 text-gray-300 text-sm font-medium">Password</Text>
              <TextInput
                className="rounded-xl bg-surface px-4 py-3 text-white text-base"
                placeholder="••••••••"
                placeholderTextColor="#6B7280"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              className={`mt-2 rounded-xl py-4 items-center ${loading ? 'bg-primary-700 opacity-60' : 'bg-primary'}`}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text className="text-white font-semibold text-base">
                {loading ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sign up link */}
          <View className="mt-8 flex-row justify-center">
            <Text className="text-gray-400">Don't have an account? </Text>
            <Link href="/(auth)/register">
              <Text className="text-primary font-semibold">Sign up</Text>
            </Link>
          </View>

          {/* Dev panel — only in __DEV__ builds */}
          {__DEV__ && <DevPanel />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
