import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../lib/authApi';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  async function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await authApi.logout().catch(() => {});
          await clearAuth();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const menuItems = [
    ...(user?.role === 'ADMIN'
      ? [{ label: 'Admin Dashboard', icon: 'settings-outline', route: '/admin' }]
      : []),
    ...(user?.role === 'ORGANIZER' || user?.role === 'ADMIN'
      ? [{ label: 'Organizer Dashboard', icon: 'storefront-outline', route: '/organizer' }]
      : []),
    ...(user?.role === 'SCANNER' || user?.role === 'ADMIN'
      ? [{ label: 'Scan Tickets', icon: 'qr-code-outline', route: '/scan' }]
      : []),
  ];

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <ScrollView>
        {/* Profile header */}
        <View className="px-4 py-6">
          <View className="flex-row items-center gap-4">
            <View className="w-16 h-16 rounded-full bg-primary items-center justify-center">
              <Text className="text-white text-2xl font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text className="text-white font-bold text-xl">{user?.name}</Text>
              <Text className="text-gray-400 text-sm">{user?.email}</Text>
              <View className="mt-1 rounded-full bg-primary-900 px-2 py-0.5 self-start">
                <Text className="text-primary text-xs font-medium">{user?.role}</Text>
              </View>
            </View>
          </View>

          {/* Wallet */}
          <View className="mt-4 rounded-xl bg-surface p-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="wallet-outline" size={16} color="#7C3AED" />
              <Text className="text-gray-300 text-sm font-medium">Blockchain Wallet</Text>
            </View>
            <Text className="text-gray-500 text-xs font-mono" numberOfLines={1}>
              {user?.walletAddress}
            </Text>
            <Text className="mt-1 text-gray-600 text-xs">
              Polygon Network · Managed for you
            </Text>
          </View>
        </View>

        {/* Menu items */}
        {menuItems.length > 0 && (
          <View className="mx-4 mb-4 rounded-xl bg-surface overflow-hidden">
            {menuItems.map((item, idx) => (
              <TouchableOpacity
                key={item.route}
                className={`flex-row items-center px-4 py-4 ${idx < menuItems.length - 1 ? 'border-b border-gray-700' : ''}`}
                onPress={() => router.push(item.route as any)}
              >
                <Ionicons name={item.icon as any} size={20} color="#7C3AED" />
                <Text className="flex-1 ml-3 text-white">{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Organizer apply */}
        {user?.role === 'USER' && (
          <TouchableOpacity
            className="mx-4 mb-4 rounded-xl bg-surface px-4 py-4 flex-row items-center"
            onPress={() => router.push('/organizer/apply')}
          >
            <Ionicons name="add-circle-outline" size={20} color="#F59E0B" />
            <Text className="flex-1 ml-3 text-white">Become an Organizer</Text>
            <Ionicons name="chevron-forward" size={16} color="#6B7280" />
          </TouchableOpacity>
        )}

        {/* Logout */}
        <TouchableOpacity
          className="mx-4 mb-8 rounded-xl bg-red-900/20 px-4 py-4 flex-row items-center"
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text className="flex-1 ml-3 text-red-400">Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
