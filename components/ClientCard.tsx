import React from 'react';
import { View, Text, Alert, Linking } from 'react-native';
import { Band } from './Band';
import { Button } from './Button';
import { Card } from './Card';
import { Icon } from './Icon';
import { Pill } from './Pill';
import { useTokens } from '../theme/ThemeProvider';
import { fontFor, space, type } from '../theme/tokens';
import { isDialable, toDialString, type JobContact } from '../lib/jobContact';
import { vehicleLine } from '../lib/route';

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
// Bottom row: a car icon and one plain line, "MPV, Alphard WA 1234 B" (type,
// then model and plate; lib/route.ts vehicleLine). When no vehicle is assigned
// it falls back to the requested vehicle type alone.
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

  const car = vehicleLine({ type: vehicleType, model: vehicleModel, plate: vehiclePlate });

  const strong = { fontFamily: fontFor('600'), fontWeight: '600' } as const;

  return (
    <Card style={{ padding: space[5], gap: space[4] }}>
      {/* Top section: identity + pax pill */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3] }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[type.label, strong, { color: T.text2 }]}>
            {passengerName ? 'Passenger' : 'Client'}
          </Text>
          <Text style={[type.heading, strong, { color: T.text }]} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        {pax != null && <Pill tone="neutral" icon="users">{pax} pax</Pill>}
      </View>

      {dialable && (
        <Button variant="secondary" full icon="phone" onPress={call}>
          {/* numberOfLines caps a stored value that is long or carries line
              breaks, so it cannot push the rest of the card around or trail
              content below where the driver stops reading. */}
          <Text style={[type.body, strong, { color: T.text, flexShrink: 1 }]} numberOfLines={1}>
            Call <Text>{phone}</Text>
          </Text>
        </Button>
      )}
      {dialable && phoneNote && (
        <Text style={[type.label, { color: T.text2 }]} numberOfLines={1}>
          ({phoneNote})
        </Text>
      )}
      {/* A number IS on file but is not usable. Say so plainly rather
          than rendering the stored text or showing nothing at all —
          "no number" and "the number on file is junk" are different
          problems and dispatch can only fix the second if it is told. */}
      {phone && !dialable && (
        <Band tone="amber">Number on file is not valid — contact dispatch</Band>
      )}

      {/* Bottom section: the vehicle, one item per fact */}
      <View style={{
        paddingTop: space[3],
        borderTopWidth: 1, borderTopColor: T.hairline,
        flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space[3], rowGap: space[1],
      }}>
        <Icon name="car" size={16} color={T.text3}/>
        {car ? (
          <Text style={[type.body, { color: T.text, flexShrink: 1 }]}>{car}</Text>
        ) : (
          <Text style={[type.body, { color: T.text2 }]}>No vehicle assigned</Text>
        )}
      </View>
    </Card>
  );
}
