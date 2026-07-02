import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../lib/authApi';
import { ApiError } from '../../lib/api';

export default function RegisterScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.register({ name, email, password });
      await setAuth(data.user, data.accessToken, data.refreshToken);
      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Registration failed';
      Alert.alert('Registration Failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-dark"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center px-6 py-12">
          <View className="mb-8">
            <Text className="text-3xl font-bold text-white">Create Account</Text>
            <Text className="mt-1 text-gray-400">Join BlockchainTickets</Text>
          </View>

          <View className="gap-4">
            <View>
              <Text className="mb-1 text-gray-300 text-sm font-medium">Full Name</Text>
              <TextInput
                className="rounded-xl bg-surface px-4 py-3 text-white text-base"
                placeholder="John Doe"
                placeholderTextColor="#6B7280"
                value={name}
                onChangeText={setName}
              />
            </View>
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
                placeholder="Min. 8 characters"
                placeholderTextColor="#6B7280"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              className={`mt-2 rounded-xl py-4 items-center ${loading ? 'bg-primary-700 opacity-60' : 'bg-primary'}`}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text className="text-white font-semibold text-base">
                {loading ? 'Creating account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="mt-4 text-center text-gray-500 text-xs">
            By signing up, your blockchain wallet is created automatically.
          </Text>

          <View className="mt-8 flex-row justify-center">
            <Text className="text-gray-400">Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text className="text-primary font-semibold">Sign in</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
