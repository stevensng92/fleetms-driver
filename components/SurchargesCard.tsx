import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Card } from './Card';
import { useTokens } from '../theme/ThemeProvider';
import { fontFor, space, type, TABULAR } from '../theme/tokens';

export type Surcharge = {
  id: string;
  name: string;
  amount: number;
  treatment: 'commissionable' | 'pass_through';
  paidInAdvance: boolean;
};

// Spec 215 — dispatcher-attached surcharges, shared by Job Detail and Active
// Job. These are services the driver performs (Overnight, Paging,
// Accommodation) and the extra money attached to them.
//
// Badge language is driver-facing and deliberately not the DB's vocabulary:
//   - "Paid in advance"   → cash already handed over; NOT added to pay
//   - "Added to your pay" → pass_through still owed, 100% to the driver
//   - "Counts toward fare"→ commissionable, driver earns their % of it
//
// paid_in_advance wins over treatment: once the cash is in hand the driver
// isn't owed it again, so the strikethrough + muted amount says "already
// settled" regardless of how the surcharge is classified.
//
// Renders nothing when the job carries no surcharges.
export function SurchargesCard({ items, style }: {
  items: Surcharge[];
  style?: StyleProp<ViewStyle>;
}) {
  const T = useTokens();
  if (items.length === 0) return null;
  return (
    <Card style={[{ padding: space[5], gap: space[2] }, style]}>
      <Text style={[type.title, { color: T.text }]}>Included services</Text>
      <View>
        {items.map((s, i) => (
          <View
            key={s.id}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              gap: space[4], minHeight: 56, paddingVertical: space[2],
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: T.hairline,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[type.body, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text }]}>{s.name}</Text>
              <Text style={[type.label, { color: T.text2 }]}>
                {s.paidInAdvance
                  ? 'Paid in advance'
                  : s.treatment === 'pass_through' ? 'Added to your pay' : 'Counts toward fare'}
              </Text>
            </View>
            {/* One flat style object (not an array): the tests read textDecorationLine off it. */}
            <Text style={{
              ...type.body, ...TABULAR,
              fontFamily: fontFor('600'), fontWeight: '600',
              color: s.paidInAdvance ? T.text3 : T.text,
              textDecorationLine: s.paidInAdvance ? 'line-through' : 'none',
            }}>
              RM {s.amount.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
