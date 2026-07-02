import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Clipboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { paymentsApi } from '../lib/ticketsApi';

const POLL_INTERVAL_MS = 8000;

export default function UsdcPaymentScreen() {
  const { sessionId, address, amount } = useLocalSearchParams<{
    sessionId: string;
    address: string;
    amount: string;
  }>();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [fulfilled, setFulfilled] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        const status = await paymentsApi.checkUsdcSession(sessionId);
        if (status.fulfilled) {
          setFulfilled(true);
          clearInterval(interval);
        }
      } catch {}
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [sessionId]);

  function copyAddress() {
    Clipboard.setString(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (fulfilled) {
    return (
      <SafeAreaView className="flex-1 bg-dark items-center justify-center px-6">
        <Ionicons name="checkmark-circle" size={72} color="#10B981" />
        <Text className="text-white text-2xl font-bold mt-4 text-center">Payment Received!</Text>
        <Text className="text-gray-400 text-center mt-2">
          Your ticket NFT is being minted on the Polygon blockchain.
        </Text>
        <TouchableOpacity
          className="mt-8 rounded-xl bg-primary px-8 py-4"
          onPress={() => router.replace('/(tabs)/tickets')}
        >
          <Text className="text-white font-semibold">View My Tickets</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <View className="flex-1 px-4 py-4">
        <TouchableOpacity className="mb-4" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text className="text-white text-2xl font-bold">Pay with USDC</Text>
        <Text className="text-gray-400 text-sm mt-1">Polygon Network</Text>

        <View className="mt-6 rounded-2xl bg-white p-6 items-center">
          <QRCode value={address} size={200} />
        </View>

        <View className="mt-4 rounded-2xl bg-surface p-4 gap-2">
          <Text className="text-gray-400 text-xs">Send exactly</Text>
          <Text className="text-white font-bold text-2xl">{amount} USDC</Text>
          <Text className="text-gray-400 text-xs mt-2">To address</Text>
          <TouchableOpacity
            className="flex-row items-center gap-2 bg-dark rounded-xl px-3 py-3"
            onPress={copyAddress}
          >
            <Text className="flex-1 text-gray-300 text-xs font-mono" numberOfLines={1}>
              {address}
            </Text>
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={18}
              color={copied ? '#10B981' : '#7C3AED'}
            />
          </TouchableOpacity>
          {copied && <Text className="text-green-400 text-xs text-center">Copied!</Text>}
        </View>

        <View className="mt-4 rounded-2xl bg-amber-900/10 border border-amber-900/30 p-4 gap-1">
          <View className="flex-row items-center gap-2">
            <Ionicons name="warning-outline" size={16} color="#F59E0B" />
            <Text className="text-accent text-sm font-medium">Important</Text>
          </View>
          <Text className="text-gray-400 text-xs leading-relaxed">
            Send USDC on the Polygon network only. Sending on Ethereum or other networks will result in loss of funds.
            Only send the exact amount shown above.
          </Text>
        </View>

        <View className="mt-6 flex-row items-center justify-center gap-2">
          <ActivityIndicator color="#7C3AED" size="small" />
          <Text className="text-gray-400 text-sm">Waiting for payment confirmation...</Text>
        </View>
        <Text className="text-gray-600 text-xs text-center mt-1">This page checks automatically</Text>
      </View>
    </SafeAreaView>
  );
}
