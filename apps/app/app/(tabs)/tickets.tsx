import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ticketsApi } from '../../lib/ticketsApi';
import type { ApiTicket } from '@blockchain-tickets/shared';

const STATUS_COLORS: Record<string, string> = {
  OWNED: '#10B981',
  LISTED: '#F59E0B',
  SCANNED: '#6B7280',
  VOID: '#EF4444',
};

function TicketCard({ ticket }: { ticket: ApiTicket }) {
  const router = useRouter();
  const date = new Date(ticket.event.startsAt);

  return (
    <TouchableOpacity
      className="mb-3 mx-4 rounded-2xl bg-surface p-4"
      onPress={() => router.push(`/ticket/${ticket.id}`)}
      activeOpacity={0.8}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-white font-bold text-base" numberOfLines={1}>
            {ticket.event.title}
          </Text>
          <Text className="mt-1 text-gray-400 text-sm">{ticket.tier.name}</Text>
          <Text className="mt-1 text-gray-500 text-xs">
            {date.toLocaleDateString()} · {ticket.event.venue}
          </Text>
          <Text className="mt-1 text-gray-600 text-xs font-mono">
            NFT #{ticket.tokenId}
          </Text>
        </View>
        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: `${STATUS_COLORS[ticket.status]}20` }}
        >
          <Text style={{ color: STATUS_COLORS[ticket.status] }} className="text-xs font-semibold">
            {ticket.status}
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-gray-700 pt-3">
        <Text className="text-gray-400 text-sm">
          ${(ticket.tier.faceValueCents / 100).toFixed(2)} face value
        </Text>
        <View className="flex-row items-center gap-1">
          <Ionicons name="qr-code-outline" size={14} color="#7C3AED" />
          <Text className="text-primary text-sm font-medium">View Ticket</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MyTicketsScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: ticketsApi.mine,
  });

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <View className="px-4 pb-4">
        <Text className="text-2xl font-bold text-white">My Tickets</Text>
        <Text className="text-gray-400 text-sm mt-1">All on the blockchain</Text>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TicketCard ticket={item} />}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#7C3AED" />}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center py-20">
              <Ionicons name="ticket-outline" size={48} color="#6B7280" />
              <Text className="mt-4 text-gray-400 font-medium">No tickets yet</Text>
              <Text className="text-gray-500 text-sm mt-1">Browse events to get started</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
