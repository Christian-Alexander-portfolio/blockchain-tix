import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../lib/api';

export default function OrganizerDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: organizer, isLoading, refetch } = useQuery({
    queryKey: ['organizer-me'],
    queryFn: () => apiRequest<any>('/api/organizer/me'),
  });

  const publishMutation = useMutation({
    mutationFn: (eventId: string) =>
      apiRequest(`/api/events/${eventId}/publish`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizer-me'] }),
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (eventId: string) =>
      apiRequest(`/api/events/${eventId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizer-me'] }),
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  function confirmCancel(eventId: string) {
    Alert.alert('Cancel Event', 'This will cancel the event. This cannot be undone.', [
      { text: 'Keep Event', style: 'cancel' },
      { text: 'Cancel Event', style: 'destructive', onPress: () => cancelMutation.mutate(eventId) },
    ]);
  }

  if (!organizer && !isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-dark items-center justify-center px-6">
        <Ionicons name="storefront-outline" size={48} color="#6B7280" />
        <Text className="text-white text-lg font-bold mt-4 text-center">Not an Organizer</Text>
        <Text className="text-gray-400 text-sm text-center mt-2">
          Apply to become an organizer to list events.
        </Text>
        <TouchableOpacity
          className="mt-6 rounded-xl bg-primary px-6 py-4"
          onPress={() => router.push('/organizer/apply')}
        >
          <Text className="text-white font-semibold">Apply Now</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <View className="px-4 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-white text-2xl font-bold">My Events</Text>
          {organizer && (
            <View className={`mt-1 self-start rounded-full px-2 py-0.5 ${
              organizer.status === 'APPROVED' ? 'bg-green-900/30' :
              organizer.status === 'PENDING' ? 'bg-amber-900/30' : 'bg-red-900/30'
            }`}>
              <Text className={`text-xs font-medium ${
                organizer.status === 'APPROVED' ? 'text-green-400' :
                organizer.status === 'PENDING' ? 'text-accent' : 'text-red-400'
              }`}>
                {organizer.orgName} · {organizer.status}
              </Text>
            </View>
          )}
        </View>
        {organizer?.status === 'APPROVED' && (
          <TouchableOpacity
            className="rounded-xl bg-primary px-4 py-2 flex-row items-center gap-1"
            onPress={() => router.push('/organizer/create-event')}
          >
            <Ionicons name="add" size={18} color="white" />
            <Text className="text-white font-medium text-sm">New Event</Text>
          </TouchableOpacity>
        )}
      </View>

      {organizer?.status === 'PENDING' && (
        <View className="mx-4 mb-4 rounded-xl bg-amber-900/20 border border-amber-900/30 p-4">
          <Text className="text-accent font-medium">Application Under Review</Text>
          <Text className="text-gray-400 text-xs mt-1">
            You'll receive an email when your organizer application is approved.
          </Text>
        </View>
      )}

      <FlatList
        data={organizer?.events ?? []}
        keyExtractor={(item: any) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#7C3AED" />}
        renderItem={({ item: event }: { item: any }) => (
          <TouchableOpacity
            className="mb-3 mx-4 rounded-2xl bg-surface p-4"
            onPress={() => router.push(`/event/${event.slug}`)}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-white font-bold" numberOfLines={1}>{event.title}</Text>
                <Text className="text-gray-400 text-sm mt-0.5">
                  {new Date(event.startsAt).toLocaleDateString()} · {event.venue}
                </Text>
                <Text className="text-gray-500 text-xs mt-1">
                  {event.tiers.length} tier{event.tiers.length !== 1 ? 's' : ''} ·{' '}
                  {event.tiers.reduce((s: number, t: any) => s + t.totalSupply - t.remainingSupply, 0)} sold
                </Text>
              </View>
              <View className={`rounded-full px-2 py-0.5 ${
                event.isPublished ? 'bg-green-900/30' :
                event.isCancelled ? 'bg-red-900/30' : 'bg-gray-700'
              }`}>
                <Text className={`text-xs font-medium ${
                  event.isPublished ? 'text-green-400' :
                  event.isCancelled ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {event.isCancelled ? 'CANCELLED' : event.isPublished ? 'LIVE' : 'DRAFT'}
                </Text>
              </View>
            </View>

            {!event.isCancelled && (
              <View className="mt-3 flex-row gap-2 border-t border-gray-700 pt-3">
                {!event.isPublished && (
                  <TouchableOpacity
                    className="flex-1 rounded-lg bg-green-900/20 py-2 items-center"
                    onPress={() => publishMutation.mutate(event.id)}
                  >
                    <Text className="text-green-400 text-sm font-medium">Publish</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  className="flex-1 rounded-lg bg-gray-700 py-2 items-center"
                  onPress={() => router.push(`/organizer/edit-event/${event.id}` as any)}
                >
                  <Text className="text-white text-sm font-medium">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="rounded-lg bg-red-900/20 px-4 py-2 items-center"
                  onPress={() => confirmCancel(event.id)}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center py-20">
              <Ionicons name="calendar-outline" size={48} color="#6B7280" />
              <Text className="mt-4 text-gray-400">No events yet</Text>
              {organizer?.status === 'APPROVED' && (
                <TouchableOpacity
                  className="mt-4 rounded-xl bg-primary px-6 py-3"
                  onPress={() => router.push('/organizer/create-event')}
                >
                  <Text className="text-white font-semibold">Create First Event</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
