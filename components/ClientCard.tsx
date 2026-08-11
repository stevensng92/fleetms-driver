import React from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { isDialable, toDialString, type JobContact } from '../lib/jobContact';

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
// where the booker isn't the rider), show the passenger as the headline.
// Otherwise show the billing client_name.
//
// The tap-to-call number is resolved separately from the headline, by
// lib/jobContact.ts: the passenger's own line when the dispatcher captured
// one, else the billing client's. Those two can disagree — a named passenger
// with only a client number on file — so when the number belongs to someone
// other than the person named above it, say so rather than implying the
// headline name will answer.
//
// Bottom row: assigned-vehicle line ("MPV · Alphard · WA 1234 B"). When no
// vehicle is assigned, falls back to the requested vehicle type alone.
export function ClientCard({
  clientName,
  passengerName,
  contact,
  pax,
  vehicleType,
  vehicleModel,
  vehiclePlate,
}: {
  clientName: string;
  passengerName: string | null;
  contact: JobContact;
  pax: number | null;
  vehicleType: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
}) {
  const T = useTokens();
  const displayName = passengerName ?? clientName;
  const phone = contact.phone;
  // One predicate gates BOTH the render and the tap. Rendering an unvalidated
  // value was the sharper half of the problem: the card body is a surface the
  // driver trusts more than a dialog, so a dispatcher-writable field could put
  // arbitrary chosen text there in green next to a phone icon.
  const dialable = isDialable(phone);
  // Only a caption when the line answers to someone else. With no passenger
  // name the headline already IS the client, so labelling it would be noise.
  const phoneNote = contact.source === 'client' && passengerName ? clientName : null;

  function call() {
    // `dialable` gates the render below, so this cannot fire from the UI. Kept
    // so call() is safe if it is ever bound somewhere else.
    if (!dialable) return;
    Linking.openURL(`tel:${toDialString(phone!)}`).catch(() =>
      Alert.alert('Could not start call', 'The dialer would not open.'),
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
            {dialable && (
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
                {/* numberOfLines caps a stored value that is long or carries
                    line breaks, so it cannot push the rest of the card around
                    or trail content below where the driver stops reading. */}
                <Text style={{ fontSize: 13, color: T.green, fontWeight: '600' }} numberOfLines={1}>
                  {phone}
                </Text>
                {phoneNote && (
                  <Text style={{ fontSize: 12, color: T.muted }} numberOfLines={1}>
                    ({phoneNote})
                  </Text>
                )}
              </Pressable>
            )}
            {/* A number IS on file but is not usable. Say so plainly rather
                than rendering the stored text or showing nothing at all —
                "no number" and "the number on file is junk" are different
                problems and dispatch can only fix the second if it is told. */}
            {phone && !dialable && (
              <Text style={{ fontSize: 13, color: T.muted, marginTop: 4 }} numberOfLines={1}>
                Number on file is not valid — contact dispatch
              </Text>
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
