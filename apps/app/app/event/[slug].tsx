import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi } from '../../lib/eventsApi';
import type { ApiTicketTier } from '@blockchain-tickets/shared';

export default function EventDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<ApiTicketTier | null>(null);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => eventsApi.get(slug),
    enabled: !!slug,
  });

  if (isLoading || !event) {
    return (
      <SafeAreaView className="flex-1 bg-dark items-center justify-center">
        <Text className="text-gray-400">Loading...</Text>
      </SafeAreaView>
    );
  }

  const date = new Date(event.startsAt);
  const availableTiers = event.tiers.filter((t: ApiTicketTier) => t.remainingSupply > 0);

  function handleBuy() {
    if (!selectedTier) {
      Alert.alert('Select a ticket tier', 'Please choose a ticket type first.');
      return;
    }
    router.push(`/purchase/${selectedTier.id}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <ScrollView>
        {/* Back button + hero */}
        <View className="relative">
          {event.imageUrl ? (
            <Image source={{ uri: event.imageUrl }} className="w-full h-56" resizeMode="cover" />
          ) : (
            <View className="w-full h-56 bg-gray-800 items-center justify-center">
              <Ionicons name="musical-notes-outline" size={64} color="#6B7280" />
            </View>
          )}
          <TouchableOpacity
            className="absolute top-4 left-4 bg-black/50 rounded-full p-2"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <View className="px-4 py-5">
          <Text className="text-white text-2xl font-bold">{event.title}</Text>

          <View className="mt-3 flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
            <Text className="text-gray-400 text-sm">
              {date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              at{' '}
              {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View className="mt-2 flex-row items-center gap-2">
            <Ionicons name="location-outline" size={16} color="#9CA3AF" />
            <Text className="text-gray-400 text-sm">
              {event.venue}, {event.city}
            </Text>
          </View>

          <View className="mt-2 flex-row items-center gap-2">
            <Ionicons name="person-outline" size={16} color="#9CA3AF" />
            <Text className="text-gray-400 text-sm">by {event.organizer.orgName}</Text>
          </View>

          {/* Blockchain badge */}
          <View className="mt-3 flex-row items-center gap-1 rounded-xl bg-green-900/20 px-3 py-2 self-start">
            <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
            <Text className="text-green-400 text-xs font-medium">
              Blockchain-verified tickets · No counterfeits
            </Text>
          </View>

          {event.description ? (
            <Text className="mt-4 text-gray-300 text-sm leading-relaxed">{event.description}</Text>
          ) : null}

          {/* Ticket tiers */}
          <Text className="mt-6 text-white font-bold text-lg">Select Tickets</Text>

          {event.tiers.map((tier: ApiTicketTier) => {
            const sold = tier.remainingSupply === 0;
            const isSelected = selectedTier?.id === tier.id;
            return (
              <TouchableOpacity
                key={tier.id}
                className={`mt-3 rounded-xl border-2 p-4 ${
                  isSelected ? 'border-primary bg-primary/10' : 'border-gray-700 bg-surface'
                } ${sold ? 'opacity-50' : ''}`}
                onPress={() => !sold && setSelectedTier(tier)}
                disabled={sold}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-white font-semibold">{tier.name}</Text>
                    {tier.description ? (
                      <Text className="text-gray-400 text-xs mt-0.5">{tier.description}</Text>
                    ) : null}
                    <Text className="text-gray-500 text-xs mt-1">
                      {sold ? 'Sold out' : `${tier.remainingSupply} remaining`}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-white font-bold text-lg">
                      ${(tier.faceValueCents / 100).toFixed(2)}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#7C3AED" />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Buy CTA */}
      {availableTiers.length > 0 && (
        <View className="px-4 py-4 border-t border-gray-700 bg-dark">
          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${selectedTier ? 'bg-primary' : 'bg-gray-700'}`}
            onPress={handleBuy}
          >
            <Text className="text-white font-semibold text-base">
              {selectedTier
                ? `Buy Ticket — $${(selectedTier.faceValueCents / 100).toFixed(2)}`
                : 'Select a Ticket Type'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
