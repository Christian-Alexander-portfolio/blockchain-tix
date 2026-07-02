import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi } from '../../lib/eventsApi';
import type { ApiEvent } from '@blockchain-tickets/shared';

function EventCard({ event }: { event: ApiEvent }) {
  const router = useRouter();
  const date = new Date(event.startsAt);
  const minPrice = event.tiers.length > 0
    ? Math.min(...event.tiers.map((t) => t.faceValueCents))
    : 0;

  return (
    <TouchableOpacity
      className="mb-4 mx-4 rounded-2xl bg-surface overflow-hidden"
      onPress={() => router.push(`/event/${event.slug}`)}
      activeOpacity={0.8}
    >
      {event.imageUrl ? (
        <Image source={{ uri: event.imageUrl }} className="w-full h-44" resizeMode="cover" />
      ) : (
        <View className="w-full h-44 bg-gray-700 items-center justify-center">
          <Ionicons name="musical-notes-outline" size={48} color="#6B7280" />
        </View>
      )}
      <View className="p-4">
        <Text className="text-white font-bold text-lg" numberOfLines={1}>
          {event.title}
        </Text>
        <Text className="mt-1 text-gray-400 text-sm" numberOfLines={1}>
          {event.venue} · {event.city}
        </Text>
        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
            <Text className="text-gray-400 text-xs">
              {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
          <View className="rounded-full bg-primary-900 px-3 py-1">
            <Text className="text-primary text-xs font-semibold">
              {minPrice > 0 ? `From $${(minPrice / 100).toFixed(2)}` : 'Free'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['events', searchQuery],
    queryFn: () => eventsApi.list({ search: searchQuery || undefined }),
  });

  return (
    <SafeAreaView className="flex-1 bg-dark">
      {/* Header */}
      <View className="px-4 pb-4">
        <Text className="text-2xl font-bold text-white">Upcoming Events</Text>
        <Text className="text-gray-400 text-sm mt-1">Blockchain-verified tickets</Text>

        {/* Search */}
        <View className="mt-4 flex-row items-center rounded-xl bg-surface px-3">
          <Ionicons name="search-outline" size={18} color="#6B7280" />
          <TextInput
            className="flex-1 py-3 px-2 text-white text-sm"
            placeholder="Search events..."
            placeholderTextColor="#6B7280"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => setSearchQuery(search)}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setSearchQuery(''); }}>
              <Ionicons name="close-circle" size={18} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={data?.events ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EventCard event={item} />}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#7C3AED" />}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center py-20">
              <Ionicons name="calendar-outline" size={48} color="#6B7280" />
              <Text className="mt-4 text-gray-400">No events found</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
