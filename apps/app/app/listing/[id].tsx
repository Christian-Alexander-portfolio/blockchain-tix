import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { listingsApi, paymentsApi } from '../../lib/ticketsApi';
import { BraintreeWebView } from '../../components/BraintreeWebView';
import { ApiError } from '../../lib/api';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showBraintree, setShowBraintree] = useState(false);

  const { data: listing, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => listingsApi.get(id),
    enabled: !!id,
  });

  const { data: tokenData } = useQuery({
    queryKey: ['braintree-token'],
    queryFn: paymentsApi.getBraintreeToken,
    enabled: !!listing,
  });

  const buyMutation = useMutation({
    mutationFn: (nonce: string) => listingsApi.buy(id, nonce),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      Alert.alert(
        'Purchase Successful!',
        'The ticket NFT is being transferred to your wallet.',
        [{ text: 'View Ticket', onPress: () => router.replace(`/ticket/${result.ticket.id}`) }],
      );
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Purchase failed';
      Alert.alert('Error', msg);
    },
  });

  if (isLoading || !listing || !listing.ticket) {
    return (
      <SafeAreaView className="flex-1 bg-dark items-center justify-center">
        <ActivityIndicator color="#7C3AED" />
      </SafeAreaView>
    );
  }

  const { ticket } = listing;
  const faceValue = ticket.tier.faceValueCents;
  const markup = Math.round(((listing.askPriceCents - faceValue) / faceValue) * 100);
  const date = new Date(ticket.event.startsAt);
  const amount = (listing.askPriceCents / 100).toFixed(2);

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <ScrollView>
        <View className="px-4 py-4">
          <TouchableOpacity className="mb-4" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <Text className="text-white text-2xl font-bold">{ticket.event.title}</Text>
          <Text className="text-gray-400 mt-1">{ticket.tier.name}</Text>

          <View className="mt-3 flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
            <Text className="text-gray-400 text-sm">
              {date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View className="mt-1 flex-row items-center gap-2">
            <Ionicons name="location-outline" size={16} color="#9CA3AF" />
            <Text className="text-gray-400 text-sm">
              {ticket.event.venue}, {ticket.event.city}
            </Text>
          </View>

          {/* Price breakdown */}
          <View className="mt-5 rounded-2xl bg-surface p-4 gap-3">
            <View className="flex-row justify-between">
              <Text className="text-gray-400">Face value</Text>
              <Text className="text-white">${(faceValue / 100).toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-400">Resale markup</Text>
              <Text className="text-accent">+{markup}%</Text>
            </View>
            <View className="flex-row justify-between border-t border-gray-700 pt-3">
              <Text className="text-white font-bold">Total</Text>
              <Text className="text-white font-bold text-xl">${amount}</Text>
            </View>
          </View>

          {/* Blockchain guarantee */}
          <View className="mt-4 rounded-2xl bg-green-900/10 border border-green-900/30 p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
              <Text className="text-green-400 font-semibold">Protected by Blockchain</Text>
            </View>
            <Text className="text-gray-400 text-xs leading-relaxed">
              This resale ticket is priced within the allowed markup cap ({markup}% ≤ 15%). The NFT
              transfer is executed on-chain simultaneously with payment — the seller can't run with
              your money.
            </Text>
            <View className="flex-row items-center gap-2 mt-1">
              <Ionicons name="person-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-400 text-xs">Seller: {listing.seller.name}</Text>
            </View>
            <Text className="text-gray-600 text-xs font-mono">NFT #{ticket.tokenId}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Buy button */}
      <View className="px-4 py-4 border-t border-gray-700">
        {buyMutation.isPending ? (
          <View className="rounded-xl bg-primary py-4 items-center flex-row justify-center gap-2">
            <ActivityIndicator color="white" size="small" />
            <Text className="text-white font-semibold">Processing...</Text>
          </View>
        ) : (
          <TouchableOpacity
            className="rounded-xl bg-primary py-4 items-center"
            onPress={() => setShowBraintree(true)}
          >
            <Text className="text-white font-semibold text-base">Buy Ticket — ${amount}</Text>
          </TouchableOpacity>
        )}
      </View>

      {tokenData && (
        <BraintreeWebView
          clientToken={tokenData.clientToken}
          amount={amount}
          visible={showBraintree}
          onNonce={(nonce) => {
            setShowBraintree(false);
            buyMutation.mutate(nonce);
          }}
          onCancel={() => setShowBraintree(false)}
        />
      )}
    </SafeAreaView>
  );
}
