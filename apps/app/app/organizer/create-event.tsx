import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi } from '../../lib/eventsApi';
import { ApiError } from '../../lib/api';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-gray-300 text-sm font-medium mb-1">{label}</Text>
      {children}
    </View>
  );
}

export default function CreateEventScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('US');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  // Tier fields
  const [tierName, setTierName] = useState('General Admission');
  const [tierPrice, setTierPrice] = useState('');
  const [tierSupply, setTierSupply] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const event = await eventsApi.create({ title, description, venue, address, city, country, startsAt, endsAt });
      // Create first tier
      if (tierName && tierPrice && tierSupply) {
        await eventsApi.createTier(event.id, {
          name: tierName,
          faceValueCents: Math.round(parseFloat(tierPrice) * 100),
          totalSupply: parseInt(tierSupply),
        });
      }
      return event;
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['organizer-me'] });
      Alert.alert('Event Created!', 'Your event draft is ready. Publish it when you\'re ready.', [
        { text: 'View Event', onPress: () => router.replace(`/event/${event.slug}`) },
        { text: 'Go to Dashboard', onPress: () => router.replace('/organizer') },
      ]);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Failed to create event';
      Alert.alert('Error', msg);
    },
  });

  function validate() {
    if (!title || !description || !venue || !address || !city || !startsAt || !endsAt) {
      Alert.alert('Required fields missing', 'Please fill in all required fields.');
      return false;
    }
    if (!tierPrice || !tierSupply) {
      Alert.alert('Ticket info required', 'Please set up at least one ticket tier.');
      return false;
    }
    return true;
  }

  const inputClass = 'rounded-xl bg-surface px-4 py-3 text-white';

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

            <Text className="text-white text-2xl font-bold">Create Event</Text>
            <Text className="text-gray-400 text-sm mt-1">Fill in the details below</Text>

            <View className="mt-6 gap-4">
              <Field label="Event Title *">
                <TextInput className={inputClass} placeholder="e.g. Summer Music Festival" placeholderTextColor="#6B7280" value={title} onChangeText={setTitle} />
              </Field>

              <Field label="Description *">
                <TextInput className={inputClass} placeholder="Tell attendees about your event..." placeholderTextColor="#6B7280" multiline numberOfLines={4} textAlignVertical="top" style={{ minHeight: 100 }} value={description} onChangeText={setDescription} />
              </Field>

              <Field label="Venue Name *">
                <TextInput className={inputClass} placeholder="e.g. Madison Square Garden" placeholderTextColor="#6B7280" value={venue} onChangeText={setVenue} />
              </Field>

              <Field label="Street Address *">
                <TextInput className={inputClass} placeholder="123 Main St" placeholderTextColor="#6B7280" value={address} onChangeText={setAddress} />
              </Field>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-gray-300 text-sm font-medium mb-1">City *</Text>
                  <TextInput className={inputClass} placeholder="New York" placeholderTextColor="#6B7280" value={city} onChangeText={setCity} />
                </View>
                <View className="w-20">
                  <Text className="text-gray-300 text-sm font-medium mb-1">Country</Text>
                  <TextInput className={inputClass} placeholder="US" placeholderTextColor="#6B7280" maxLength={2} autoCapitalize="characters" value={country} onChangeText={setCountry} />
                </View>
              </View>

              <Field label="Start Date/Time * (ISO format)">
                <TextInput className={inputClass} placeholder="2025-12-31T20:00:00Z" placeholderTextColor="#6B7280" value={startsAt} onChangeText={setStartsAt} autoCapitalize="none" />
              </Field>

              <Field label="End Date/Time * (ISO format)">
                <TextInput className={inputClass} placeholder="2026-01-01T02:00:00Z" placeholderTextColor="#6B7280" value={endsAt} onChangeText={setEndsAt} autoCapitalize="none" />
              </Field>

              {/* Ticket Tier */}
              <View className="mt-2">
                <Text className="text-white font-bold text-base mb-3">First Ticket Tier</Text>
                <View className="gap-3">
                  <Field label="Tier Name">
                    <TextInput className={inputClass} placeholder="General Admission" placeholderTextColor="#6B7280" value={tierName} onChangeText={setTierName} />
                  </Field>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-gray-300 text-sm font-medium mb-1">Price ($) *</Text>
                      <TextInput className={inputClass} placeholder="25.00" placeholderTextColor="#6B7280" keyboardType="decimal-pad" value={tierPrice} onChangeText={setTierPrice} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-300 text-sm font-medium mb-1">Qty *</Text>
                      <TextInput className={inputClass} placeholder="500" placeholderTextColor="#6B7280" keyboardType="number-pad" value={tierSupply} onChangeText={setTierSupply} />
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                className={`mt-2 rounded-xl py-4 items-center ${createMutation.isPending ? 'bg-primary-700 opacity-60' : 'bg-primary'}`}
                onPress={() => validate() && createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                <Text className="text-white font-semibold text-base">
                  {createMutation.isPending ? 'Creating...' : 'Create Event'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
