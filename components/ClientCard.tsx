import React from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  sedan:           'Sedan',
  sedan_executive: 'Executive',
  mpv:             'MPV',
  van:             'Van',
  coach:           'Coach',
};

// Top-of-page client/passenger card shared by Job Detail + Active Job screens.
//
// Display rule: if passengerName is set (corporate or platform-client job
// where the booker isn't the rider), show the passenger as the headline and
// surface their phone with tap-to-call. Otherwise fall back to the billing
// client_name and any client-level phone (none today; null-safe).
//
// Bottom row: assigned-vehicle line ("MPV · Alphard · WA 1234 B"). When no
// vehicle is assigned, falls back to the requested vehicle type alone.
export function ClientCard({
  clientName,
  passengerName,
  passengerPhone,
  pax,
  vehicleType,
  vehicleModel,
  vehiclePlate,
}: {
  clientName: string;
  passengerName: string | null;
  passengerPhone: string | null;
  pax: number | null;
  vehicleType: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
}) {
  const T = useTokens();
  const displayName = passengerName ?? clientName;
  const phone = passengerPhone;

  function call() {
    if (!phone) return;
    // Strip everything except digits + leading '+'. Prevents `tel:` from
    // carrying special characters (comma = pause, * = star key) that a
    // compromised passenger_phone value could use for auto-dial sequences.
    // Plus the format sanity-check rejects garbage values early.
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (!/^\+?\d{7,15}$/.test(cleaned)) {
      Alert.alert('Invalid phone number', `Stored value: ${phone}`);
      return;
    }
    Linking.openURL(`tel:${cleaned}`).catch(() =>
      Alert.alert('Could not start call', `Number: ${phone}`),
    );
  }

  // Vehicle line composition: type · model · plate. Drop falsy pieces.
  const typeLabel = vehicleType ? (VEHICLE_TYPE_LABEL[vehicleType] ?? vehicleType) : null;
  const vehicleParts = [typeLabel, vehicleModel, vehiclePlate].filter(Boolean) as string[];
  const vehicleLine = vehicleParts.length > 0 ? vehicleParts.join(' · ') : 'No vehicle assigned';

  return (
    <View style={{
      backgroundColor: T.surface, borderRadius: 12, marginBottom: 18,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    }}>
      {/* Top section: identity + pax chip */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
        <Text style={{
          fontSize: 10.5, fontWeight: '800', color: T.muted,
          letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6,
        }}>
          {passengerName ? 'Passenger' : 'Client'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: T.text, letterSpacing: -0.3 }} numberOfLines={1}>
              {displayName}
            </Text>
            {phone && (
              <Pressable
                onPress={call}
                style={({ pressed }) => ({
                  marginTop: 4,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  alignSelf: 'flex-start',
                  opacity: pressed ? 0.5 : 1,
                })}
                hitSlop={6}
              >
                <Icon name="phone" size={13} color={T.green}/>
                <Text style={{ fontSize: 13, color: T.green, fontWeight: '600' }}>
                  {phone}
                </Text>
              </Pressable>
            )}
          </View>
          {pax != null && (
            <View style={{
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999,
              backgroundColor: T.raised,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <Icon name="users" size={12} color={T.muted}/>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: T.text }}>
                {pax} pax
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom section: vehicle line */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 10,
        borderTopWidth: 1, borderTopColor: T.border,
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <Icon name="car" size={14} color={T.muted}/>
        <Text style={{
          flex: 1, fontSize: 13, fontWeight: '600', color: T.muted,
          letterSpacing: 0.1,
        }} numberOfLines={1}>
          {vehicleLine}
        </Text>
      </View>
    </View>
  );
}
