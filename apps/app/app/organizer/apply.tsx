import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../lib/api';
import { ApiError } from '../../lib/api';

export default function OrganizerApplyScreen() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');

  const applyMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/organizer/apply', {
        method: 'POST',
        body: { orgName: businessName, websiteUrl: website || undefined, description: description || undefined },
      }),
    onSuccess: () => {
      Alert.alert(
        'Application Submitted!',
        'Your application is under review. You\'ll receive an email when approved.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/profile') }],
      );
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Submission failed';
      Alert.alert('Error', msg);
    },
  });

  function handleSubmit() {
    if (!businessName.trim()) {
      Alert.alert('Error', 'Business name is required');
      return;
    }
    applyMutation.mutate();
  }

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView className="flex-1">
          <View className="px-4 py-4">
            <TouchableOpacity className="mb-4" onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <Text className="text-white text-2xl font-bold">Become an Organizer</Text>
            <Text className="text-gray-400 text-sm mt-1">
              Host events and sell blockchain-verified tickets
            </Text>

            {/* Benefits */}
            <View className="mt-4 rounded-2xl bg-primary/10 p-4 gap-2">
              {[
                'List events and sell tickets',
                'Resale price caps enforced automatically',
                'Instant payouts minus platform fee',
                'Real-time analytics dashboard',
              ].map((benefit) => (
                <View key={benefit} className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={16} color="#7C3AED" />
                  <Text className="text-gray-300 text-sm">{benefit}</Text>
                </View>
              ))}
            </View>

            <View className="mt-6 gap-4">
              <View>
                <Text className="text-gray-300 text-sm font-medium mb-1">Business / Organization Name *</Text>
                <TextInput
                  className="rounded-xl bg-surface px-4 py-3 text-white"
                  placeholder="e.g. Live Nation, Local Music Venue"
                  placeholderTextColor="#6B7280"
                  value={businessName}
                  onChangeText={setBusinessName}
                />
              </View>
              <View>
                <Text className="text-gray-300 text-sm font-medium mb-1">Website (optional)</Text>
                <TextInput
                  className="rounded-xl bg-surface px-4 py-3 text-white"
                  placeholder="https://yourwebsite.com"
                  placeholderTextColor="#6B7280"
                  keyboardType="url"
                  autoCapitalize="none"
                  value={website}
                  onChangeText={setWebsite}
                />
              </View>
              <View>
                <Text className="text-gray-300 text-sm font-medium mb-1">Tell us about your events</Text>
                <TextInput
                  className="rounded-xl bg-surface px-4 py-3 text-white"
                  placeholder="What kind of events do you run? How many per year?"
                  placeholderTextColor="#6B7280"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={{ minHeight: 100 }}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              <TouchableOpacity
                className="rounded-xl bg-primary py-4 items-center"
                onPress={handleSubmit}
                disabled={applyMutation.isPending}
              >
                <Text className="text-white font-semibold text-base">
                  {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
                </Text>
              </TouchableOpacity>

              <Text className="text-gray-500 text-xs text-center">
                Applications are reviewed within 1-2 business days.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
