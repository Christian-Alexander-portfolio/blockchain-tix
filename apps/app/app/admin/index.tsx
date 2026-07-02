import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../lib/ticketsApi';
import { ApiError } from '../../lib/api';

function OrganizerRow({ org, onApprove, onSuspend }: any) {
  return (
    <View className="border-b border-gray-700 px-4 py-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-white font-medium">{org.businessName}</Text>
          <Text className="text-gray-400 text-sm">{org.user?.email}</Text>
          <View className={`mt-1 self-start rounded-full px-2 py-0.5 ${
            org.status === 'PENDING' ? 'bg-amber-900/30' :
            org.status === 'APPROVED' ? 'bg-green-900/30' : 'bg-red-900/30'
          }`}>
            <Text className={`text-xs font-medium ${
              org.status === 'PENDING' ? 'text-accent' :
              org.status === 'APPROVED' ? 'text-green-400' : 'text-red-400'
            }`}>{org.status}</Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          {org.status === 'PENDING' && (
            <TouchableOpacity
              className="rounded-lg bg-green-900/30 px-3 py-2"
              onPress={() => onApprove(org.id)}
            >
              <Ionicons name="checkmark" size={16} color="#10B981" />
            </TouchableOpacity>
          )}
          {org.status === 'APPROVED' && (
            <TouchableOpacity
              className="rounded-lg bg-red-900/20 px-3 py-2"
              onPress={() => onSuspend(org.id)}
            >
              <Ionicons name="ban-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'organizers' | 'settings' | 'analytics'>('organizers');
  const [markupMin, setMarkupMin] = useState('');
  const [markupMax, setMarkupMax] = useState('');
  const [feePercent, setFeePercent] = useState('');

  const { data: organizers, isLoading: orgsLoading, refetch: refetchOrgs } = useQuery({
    queryKey: ['admin-organizers'],
    queryFn: () => adminApi.getOrganizers(),
    enabled: activeTab === 'organizers',
  });

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminApi.getSettings,
    enabled: activeTab === 'settings',
    onSuccess: (data: any) => {
      setMarkupMin(String(data.resaleMarkupMinBps / 100));
      setMarkupMax(String(data.resaleMarkupMaxBps / 100));
      setFeePercent(String(data.platformFeeBps / 100));
    },
  } as any);

  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: adminApi.getAnalytics,
    enabled: activeTab === 'analytics',
  });

  const approveMutation = useMutation({
    mutationFn: adminApi.approveOrganizer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-organizers'] }),
  });

  const suspendMutation = useMutation({
    mutationFn: adminApi.suspendOrganizer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-organizers'] }),
  });

  const settingsMutation = useMutation({
    mutationFn: () =>
      adminApi.updateSettings({
        resaleMarkupMinBps: Math.round(parseFloat(markupMin) * 100),
        resaleMarkupMaxBps: Math.round(parseFloat(markupMax) * 100),
        platformFeeBps: Math.round(parseFloat(feePercent) * 100),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      Alert.alert('Saved', 'Platform settings updated and synced to smart contract.');
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Update failed';
      Alert.alert('Error', msg);
    },
  });

  const tabs: Array<{ id: typeof activeTab; label: string; icon: string }> = [
    { id: 'organizers', label: 'Organizers', icon: 'people-outline' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline' },
    { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <View className="px-4 pb-2">
        <Text className="text-white text-2xl font-bold">Admin Dashboard</Text>
      </View>

      {/* Tab bar */}
      <View className="flex-row mx-4 mb-4 rounded-xl bg-surface p-1">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            className={`flex-1 flex-row items-center justify-center gap-1 rounded-lg py-2 ${activeTab === tab.id ? 'bg-primary' : ''}`}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as any}
              size={14}
              color={activeTab === tab.id ? 'white' : '#9CA3AF'}
            />
            <Text className={`text-xs font-medium ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={
          activeTab === 'organizers'
            ? <RefreshControl refreshing={orgsLoading} onRefresh={refetchOrgs} tintColor="#7C3AED" />
            : undefined
        }
      >
        {/* Organizers tab */}
        {activeTab === 'organizers' && (
          <View className="rounded-2xl bg-surface mx-4 overflow-hidden">
            {(!organizers || organizers.length === 0) ? (
              <View className="py-12 items-center">
                <Text className="text-gray-400">No organizers yet</Text>
              </View>
            ) : (
              organizers.map((org: any) => (
                <OrganizerRow
                  key={org.id}
                  org={org}
                  onApprove={(id: string) => approveMutation.mutate(id)}
                  onSuspend={(id: string) => suspendMutation.mutate(id)}
                />
              ))
            )}
          </View>
        )}

        {/* Settings tab */}
        {activeTab === 'settings' && (
          <View className="px-4 gap-4">
            <View className="rounded-2xl bg-surface p-4 gap-4">
              <Text className="text-white font-bold text-base">Resale Markup Cap</Text>
              <Text className="text-gray-400 text-xs -mt-2">
                These values are synced to the smart contract on save.
              </Text>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-gray-300 text-sm mb-1">Min %</Text>
                  <TextInput
                    className="rounded-xl bg-dark px-4 py-3 text-white"
                    keyboardType="decimal-pad"
                    value={markupMin}
                    onChangeText={setMarkupMin}
                    placeholder="10"
                    placeholderTextColor="#6B7280"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-300 text-sm mb-1">Max %</Text>
                  <TextInput
                    className="rounded-xl bg-dark px-4 py-3 text-white"
                    keyboardType="decimal-pad"
                    value={markupMax}
                    onChangeText={setMarkupMax}
                    placeholder="20"
                    placeholderTextColor="#6B7280"
                  />
                </View>
              </View>

              <View>
                <Text className="text-gray-300 text-sm mb-1">Platform Fee %</Text>
                <TextInput
                  className="rounded-xl bg-dark px-4 py-3 text-white"
                  keyboardType="decimal-pad"
                  value={feePercent}
                  onChangeText={setFeePercent}
                  placeholder="5"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <TouchableOpacity
                className="rounded-xl bg-primary py-4 items-center"
                onPress={() => settingsMutation.mutate()}
                disabled={settingsMutation.isPending}
              >
                <Text className="text-white font-semibold">
                  {settingsMutation.isPending ? 'Saving...' : 'Save & Sync to Blockchain'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Analytics tab */}
        {activeTab === 'analytics' && analytics && (
          <View className="px-4 gap-4">
            {[
              { label: 'Total Revenue', value: `$${((analytics.totalRevenueCents ?? 0) / 100).toFixed(2)}`, icon: 'cash-outline' },
              { label: 'Tickets Sold', value: analytics.totalTickets ?? 0, icon: 'ticket-outline' },
              { label: 'Active Events', value: analytics.activeEvents ?? 0, icon: 'calendar-outline' },
              { label: 'Total Users', value: analytics.totalUsers ?? 0, icon: 'people-outline' },
            ].map((stat) => (
              <View key={stat.label} className="flex-row items-center rounded-2xl bg-surface p-4 gap-4">
                <View className="w-12 h-12 rounded-xl bg-primary/10 items-center justify-center">
                  <Ionicons name={stat.icon as any} size={22} color="#7C3AED" />
                </View>
                <View>
                  <Text className="text-gray-400 text-sm">{stat.label}</Text>
                  <Text className="text-white font-bold text-2xl">{stat.value}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
