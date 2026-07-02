import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { scanApi } from '../lib/ticketsApi';
import { ApiError } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function ScanScreen() {
  const { user } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<{ success: boolean; message: string; ticketId?: string } | null>(null);
  const [eventId] = useState(''); // In production: passed via navigation params

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-dark items-center justify-center">
        <Text className="text-gray-400">Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-dark items-center justify-center px-6">
        <Ionicons name="camera-outline" size={48} color="#6B7280" />
        <Text className="text-white text-lg font-bold mt-4 text-center">Camera Access Required</Text>
        <Text className="text-gray-400 text-sm text-center mt-2">
          Grant camera access to scan ticket QR codes
        </Text>
        <TouchableOpacity
          className="mt-6 rounded-xl bg-primary px-6 py-4"
          onPress={requestPermission}
        >
          <Text className="text-white font-semibold">Grant Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (!scanning) return;
    setScanning(false);

    try {
      const res = await scanApi.verify(data, eventId);
      setResult({ success: true, message: `Valid! ${res.ticket?.event?.title ?? ''}`, ticketId: res.ticketId });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Invalid QR code';
      setResult({ success: false, message: msg });
    }
  }

  function resetScan() {
    setResult(null);
    setScanning(true);
  }

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <View className="px-4 pb-4">
        <Text className="text-white text-2xl font-bold">Scan Ticket</Text>
        <Text className="text-gray-400 text-sm mt-1">Point camera at ticket QR code</Text>
      </View>

      <View className="flex-1 mx-4 rounded-3xl overflow-hidden">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
        >
          {/* Viewfinder overlay */}
          <View className="flex-1 items-center justify-center">
            <View
              className="w-64 h-64 border-4 rounded-3xl"
              style={{ borderColor: result ? (result.success ? '#10B981' : '#EF4444') : '#7C3AED' }}
            />
          </View>
        </CameraView>
      </View>

      {/* Result overlay */}
      {result && (
        <View
          className="mx-4 mt-4 rounded-2xl p-5"
          style={{ backgroundColor: result.success ? '#10B98120' : '#EF444420' }}
        >
          <View className="flex-row items-center gap-3">
            <Ionicons
              name={result.success ? 'checkmark-circle' : 'close-circle'}
              size={32}
              color={result.success ? '#10B981' : '#EF4444'}
            />
            <View className="flex-1">
              <Text
                className="font-bold text-lg"
                style={{ color: result.success ? '#10B981' : '#EF4444' }}
              >
                {result.success ? 'Valid Ticket' : 'Invalid Ticket'}
              </Text>
              <Text className="text-gray-300 text-sm mt-0.5">{result.message}</Text>
            </View>
          </View>
          <TouchableOpacity
            className="mt-4 rounded-xl bg-white/10 py-3 items-center"
            onPress={resetScan}
          >
            <Text className="text-white font-medium">Scan Next Ticket</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
