import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BraintreeWebView } from '../../components/BraintreeWebView';
import { paymentsApi, ticketsApi } from '../../lib/ticketsApi';
import { ApiError } from '../../lib/api';

export default function PurchaseScreen() {
  const { tierId } = useLocalSearchParams<{ tierId: string }>();
  const router = useRouter();
  const [showBraintree, setShowBraintree] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'USDC'>('CARD');

  const { data: tokenData, isLoading: tokenLoading } = useQuery({
    queryKey: ['braintree-token'],
    queryFn: paymentsApi.getBraintreeToken,
    enabled: paymentMethod === 'CARD',
  });

  const purchaseMutation = useMutation({
    mutationFn: (nonce: string) =>
      ticketsApi.purchase({
        tierId,
        paymentMethod: 'BRAINTREE_CARD',
        paymentNonce: nonce,
      }),
    onSuccess: (result) => {
      if ('ticket' in result) {
        Alert.alert('Purchase Successful!', 'Your ticket NFT is being minted on the blockchain.', [
          {
            text: 'View Ticket',
            onPress: () => router.replace(`/ticket/${result.ticket.id}`),
          },
        ]);
      }
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Purchase failed';
      Alert.alert('Payment Failed', msg);
    },
  });

  const usdcMutation = useMutation({
    mutationFn: () =>
      ticketsApi.purchase({ tierId, paymentMethod: 'USDC_POLYGON' }),
    onSuccess: (result) => {
      if ('type' in result && result.type === 'USDC_SESSION') {
        router.push({
          pathname: '/usdc-payment',
          params: { sessionId: result.session.id, address: result.session.toAddress },
        });
      }
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Failed to create USDC session';
      Alert.alert('Error', msg);
    },
  });

  function handleNonce(nonce: string) {
    setShowBraintree(false);
    purchaseMutation.mutate(nonce);
  }

  const amount = '25.00'; // In a real flow, fetch tier price here

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <ScrollView>
        <View className="px-4 py-4">
          <TouchableOpacity className="mb-4" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <Text className="text-white text-2xl font-bold">Complete Purchase</Text>
          <Text className="text-gray-400 text-sm mt-1">Your ticket will be minted as an NFT on Polygon</Text>

          {/* Payment method selector */}
          <Text className="text-white font-semibold mt-6 mb-3">Payment Method</Text>
          <View className="gap-3">
            <TouchableOpacity
              className={`rounded-xl border-2 p-4 flex-row items-center gap-3 ${
                paymentMethod === 'CARD' ? 'border-primary bg-primary/10' : 'border-gray-700 bg-surface'
              }`}
              onPress={() => setPaymentMethod('CARD')}
            >
              <Ionicons name="card-outline" size={22} color={paymentMethod === 'CARD' ? '#7C3AED' : '#9CA3AF'} />
              <View className="flex-1">
                <Text className="text-white font-medium">Card / Apple Pay / Google Pay</Text>
                <Text className="text-gray-400 text-xs">Via Braintree secure checkout</Text>
              </View>
              {paymentMethod === 'CARD' && <Ionicons name="checkmark-circle" size={20} color="#7C3AED" />}
            </TouchableOpacity>

            <TouchableOpacity
              className={`rounded-xl border-2 p-4 flex-row items-center gap-3 ${
                paymentMethod === 'USDC' ? 'border-primary bg-primary/10' : 'border-gray-700 bg-surface'
              }`}
              onPress={() => setPaymentMethod('USDC')}
            >
              <Text className="text-lg">💎</Text>
              <View className="flex-1">
                <Text className="text-white font-medium">USDC on Polygon</Text>
                <Text className="text-gray-400 text-xs">Send USDC to a deposit address</Text>
              </View>
              {paymentMethod === 'USDC' && <Ionicons name="checkmark-circle" size={20} color="#7C3AED" />}
            </TouchableOpacity>
          </View>

          {/* Blockchain info */}
          <View className="mt-6 rounded-xl bg-surface p-4 gap-3">
            <View className="flex-row items-center gap-2">
              <Ionicons name="shield-checkmark-outline" size={16} color="#10B981" />
              <Text className="text-green-400 text-sm font-medium">Blockchain-verified ownership</Text>
            </View>
            <Text className="text-gray-400 text-xs leading-relaxed">
              Your ticket is minted as an ERC-721 NFT on Polygon. It's uniquely yours and can't be duplicated.
              Resales are enforced on-chain, capped at a max markup above face value.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Pay button */}
      <View className="px-4 py-4 border-t border-gray-700">
        {purchaseMutation.isPending ? (
          <View className="rounded-xl bg-primary py-4 items-center gap-2 flex-row justify-center">
            <ActivityIndicator color="white" size="small" />
            <Text className="text-white font-semibold">Processing...</Text>
          </View>
        ) : paymentMethod === 'CARD' ? (
          <TouchableOpacity
            className="rounded-xl bg-primary py-4 items-center"
            onPress={() => setShowBraintree(true)}
            disabled={tokenLoading}
          >
            <Text className="text-white font-semibold text-base">
              {tokenLoading ? 'Loading...' : 'Pay with Card / Apple Pay / Google Pay'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="rounded-xl bg-primary py-4 items-center"
            onPress={() => usdcMutation.mutate()}
            disabled={usdcMutation.isPending}
          >
            <Text className="text-white font-semibold text-base">
              {usdcMutation.isPending ? 'Creating session...' : 'Pay with USDC'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Braintree WebView modal */}
      {tokenData && (
        <BraintreeWebView
          clientToken={tokenData.clientToken}
          amount={amount}
          visible={showBraintree}
          onNonce={handleNonce}
          onCancel={() => setShowBraintree(false)}
        />
      )}
    </SafeAreaView>
  );
}
