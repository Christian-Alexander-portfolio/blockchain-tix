import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { listingsApi } from '../../lib/ticketsApi';
import type { ApiListing } from '@blockchain-tickets/shared';

function ListingCard({ listing }: { listing: ApiListing }) {
  const router = useRouter();
  if (!listing.ticket) return null;

  const faceValue = listing.ticket.tier.faceValueCents;
  const markup = Math.round(((listing.askPriceCents - faceValue) / faceValue) * 100);
  const date = new Date(listing.ticket.event.startsAt);

  return (
    <TouchableOpacity
      className="mb-3 mx-4 rounded-2xl bg-surface p-4"
      onPress={() => router.push(`/listing/${listing.id}`)}
      activeOpacity={0.8}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-white font-bold text-base" numberOfLines={1}>
            {listing.ticket.event.title}
          </Text>
          <Text className="mt-1 text-gray-400 text-sm">{listing.ticket.tier.name}</Text>
          <Text className="mt-1 text-gray-500 text-xs">
            {date.toLocaleDateString()} · {listing.ticket.event.venue}
          </Text>
          <Text className="mt-1 text-gray-500 text-xs">
            Sold by {listing.seller.name}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-white font-bold text-lg">
            ${(listing.askPriceCents / 100).toFixed(2)}
          </Text>
          <View className="mt-1 rounded-full bg-amber-900/30 px-2 py-0.5">
            <Text className="text-accent text-xs font-medium">+{markup}% markup</Text>
          </View>
        </View>
      </View>

      <View className="mt-3 flex-row items-center gap-1 border-t border-gray-700 pt-3">
        <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
        <Text className="text-green-400 text-xs">Blockchain verified · Face value ${(faceValue / 100).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MarketplaceScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['listings'],
    queryFn: () => listingsApi.browse(),
  });

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <View className="px-4 pb-4">
        <Text className="text-2xl font-bold text-white">Resale Market</Text>
        <Text className="text-gray-400 text-sm mt-1">
          Capped at max 15% above face value
        </Text>
      </View>

      <FlatList
        data={data?.listings ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListingCard listing={item} />}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#7C3AED" />}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center py-20">
              <Ionicons name="pricetag-outline" size={48} color="#6B7280" />
              <Text className="mt-4 text-gray-400">No resale listings right now</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
