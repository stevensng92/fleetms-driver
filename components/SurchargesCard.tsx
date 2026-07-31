import React from 'react';
import { View, Text } from 'react-native';
import { SectionLabel } from './AppHeader';
import { useTokens } from '../theme/ThemeProvider';

export type Surcharge = {
  id: string;
  name: string;
  amount: number;
  treatment: 'commissionable' | 'pass_through';
  paidInAdvance: boolean;
};

// Spec #215 — dispatcher-attached surcharges, shared by Job Detail and Active
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
export function SurchargesCard({ items, style }: { items: Surcharge[]; style?: any }) {
  const T = useTokens();
  if (items.length === 0) return null;
  return (
    <View style={style}>
      <SectionLabel>Included services</SectionLabel>
      <View style={{
        backgroundColor: T.surface, borderRadius: 12,
        paddingHorizontal: 16, paddingVertical: 6, marginBottom: 18,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}>
        {items.map((s, i) => (
          <View
            key={s.id}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: 10,
              borderBottomWidth: i === items.length - 1 ? 0 : 1,
              borderBottomColor: T.border,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: T.text }}>{s.name}</Text>
              <Text style={{
                fontSize: 11.5, marginTop: 2, fontWeight: '600',
                color: s.paidInAdvance ? T.mutedLight : T.muted,
              }}>
                {s.paidInAdvance
                  ? 'Paid in advance'
                  : s.treatment === 'pass_through' ? 'Added to your pay' : 'Counts toward fare'}
              </Text>
            </View>
            <Text style={{
              fontSize: 15, fontWeight: '700', letterSpacing: -0.3,
              color: s.paidInAdvance ? T.mutedLight : T.text,
              textDecorationLine: s.paidInAdvance ? 'line-through' : 'none',
            }}>
              RM {s.amount.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
