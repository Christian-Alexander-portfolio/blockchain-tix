import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { ticketsApi } from '../../lib/ticketsApi';
import { ApiError } from '../../lib/api';

const QR_REFRESH_MS = 4 * 60 * 1000; // 4 minutes (JWT expires at 5)

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [listPrice, setListPrice] = useState('');
  const [showListModal, setShowListModal] = useState(false);

  const { data: ticket } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () =>
      ticketsApi.mine().then((tickets) => tickets.find((t) => t.id === id) ?? null),
    enabled: !!id,
  });

  // QR token — auto-refreshes every 4 minutes
  const { data: qrData, refetch: refetchQr } = useQuery({
    queryKey: ['ticket-qr', id],
    queryFn: () => ticketsApi.getQr(id),
    enabled: !!id && ticket?.status === 'OWNED',
    refetchInterval: QR_REFRESH_MS,
  });

  const listMutation = useMutation({
    mutationFn: (priceCents: number) => ticketsApi.listForResale(id, priceCents),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      setShowListModal(false);
      Alert.alert('Listed!', 'Your ticket is now on the resale marketplace.');
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Failed to list ticket';
      Alert.alert('Error', msg);
    },
  });

  const cancelListingMutation = useMutation({
    mutationFn: () => ticketsApi.cancelListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      Alert.alert('Listing Cancelled', 'Your ticket is no longer on the resale market.');
    },
  });

  if (!ticket) {
    return (
      <SafeAreaView className="flex-1 bg-dark items-center justify-center">
        <Text className="text-gray-400">Loading ticket...</Text>
      </SafeAreaView>
    );
  }

  const date = new Date(ticket.event.startsAt);
  const isOwned = ticket.status === 'OWNED';
  const isListed = ticket.status === 'LISTED';

  function handleListForResale() {
    const priceCents = Math.round(parseFloat(listPrice) * 100);
    if (isNaN(priceCents) || priceCents <= 0) {
      Alert.alert('Invalid price', 'Please enter a valid price.');
      return;
    }
    listMutation.mutate(priceCents);
  }

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <ScrollView>
        <View className="px-4 py-4">
          <TouchableOpacity className="mb-4" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          {/* Ticket header */}
          <View className="rounded-2xl bg-surface p-5 mb-4">
            <Text className="text-white text-xl font-bold">{ticket.event.title}</Text>
            <Text className="text-gray-400 mt-1">{ticket.tier.name}</Text>
            <Text className="text-gray-500 text-sm mt-1">
              {date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <Text className="text-gray-500 text-sm">{ticket.event.venue}, {ticket.event.city}</Text>

            {/* NFT badge */}
            <View className="mt-3 flex-row items-center gap-2">
              <View className="rounded-full bg-purple-900/40 px-3 py-1">
                <Text className="text-primary text-xs font-mono">NFT #{ticket.tokenId}</Text>
              </View>
              <View className="rounded-full px-3 py-1"
                style={{
                  backgroundColor: ticket.status === 'OWNED' ? '#10B98120' :
                    ticket.status === 'LISTED' ? '#F59E0B20' : '#6B728020'
                }}>
                <Text
                  className="text-xs font-semibold"
                  style={{
                    color: ticket.status === 'OWNED' ? '#10B981' :
                      ticket.status === 'LISTED' ? '#F59E0B' : '#6B7280'
                  }}
                >
                  {ticket.status}
                </Text>
              </View>
            </View>
          </View>

          {/* QR Code — only show for OWNED tickets */}
          {isOwned && (
            <View className="rounded-2xl bg-white p-6 mb-4 items-center">
              {qrData ? (
                <>
                  <QRCode value={qrData.qrToken} size={220} />
                  <Text className="mt-3 text-gray-500 text-xs text-center">
                    Show this QR at the venue. Refreshes automatically.
                  </Text>
                  <TouchableOpacity className="mt-2 flex-row items-center gap-1" onPress={() => refetchQr()}>
                    <Ionicons name="refresh-outline" size={14} color="#7C3AED" />
                    <Text className="text-primary text-xs">Refresh now</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View className="h-48 items-center justify-center">
                  <Text className="text-gray-400">Loading QR...</Text>
                </View>
              )}
            </View>
          )}

          {isListed && (
            <View className="rounded-2xl bg-amber-900/20 border border-amber-900/40 p-4 mb-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="pricetag-outline" size={18} color="#F59E0B" />
                <Text className="text-accent font-semibold">Listed for Resale</Text>
              </View>
              <Text className="text-gray-400 text-sm mt-1">
                Your ticket is currently listed on the resale marketplace.
              </Text>
              <TouchableOpacity
                className="mt-3 rounded-xl bg-gray-700 py-3 items-center"
                onPress={() => cancelListingMutation.mutate()}
                disabled={cancelListingMutation.isPending}
              >
                <Text className="text-white font-medium">Cancel Listing</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* List for resale */}
          {isOwned && (
            <TouchableOpacity
              className="rounded-2xl bg-surface p-4 flex-row items-center justify-between"
              onPress={() => setShowListModal(true)}
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="pricetag-outline" size={20} color="#F59E0B" />
                <View>
                  <Text className="text-white font-medium">Sell on Resale Market</Text>
                  <Text className="text-gray-400 text-xs">Up to +15% above face value</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* List for resale modal (simple inline) */}
      {showListModal && (
        <View className="absolute inset-0 bg-black/70 justify-end">
          <View className="bg-surface rounded-t-3xl p-6">
            <Text className="text-white font-bold text-lg mb-1">Set Resale Price</Text>
            <Text className="text-gray-400 text-sm mb-4">
              Face value: ${(ticket.tier.faceValueCents / 100).toFixed(2)} · Max allowed: +15%
            </Text>
            <View className="flex-row items-center bg-dark rounded-xl px-4 py-3 mb-4">
              <Text className="text-gray-300 text-lg mr-1">$</Text>
              <Text
                className="flex-1 text-white text-lg"
                onPress={() => {}}
              >
                {listPrice || '0.00'}
              </Text>
            </View>
            {/* Preset buttons */}
            <View className="flex-row gap-2 mb-4">
              {[5, 10, 15].map((pct) => {
                const price = ((ticket.tier.faceValueCents * (1 + pct / 100)) / 100).toFixed(2);
                return (
                  <TouchableOpacity
                    key={pct}
                    className="flex-1 rounded-xl bg-dark py-3 items-center"
                    onPress={() => setListPrice(price)}
                  >
                    <Text className="text-white font-medium text-sm">+{pct}%</Text>
                    <Text className="text-gray-400 text-xs">${price}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              className="rounded-xl bg-primary py-4 items-center mb-3"
              onPress={handleListForResale}
              disabled={listMutation.isPending}
            >
              <Text className="text-white font-semibold">
                {listMutation.isPending ? 'Listing...' : 'List for Resale'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="items-center py-3"
              onPress={() => setShowListModal(false)}
            >
              <Text className="text-gray-400">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
