import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import type { SpecialCommission } from '../lib/commissionRate';

// The fare card on Job Detail and Active Job. Extracted because the two screens
// carried byte-identical copies, and the sub-label below has to say different
// things on a fixed-fee job — two copies is two chances for only one of them to
// learn that.
//
// This field is `jobs.amount`: the CLIENT's fare, not the driver's take-home.
// It read "Earnings on completion" once, which was already wrong and became an
// active contradiction the moment a commission figure landed underneath it — a
// driver mid-trip would read RM 500 "earnings" on a job paying them ~RM 100.
//
// "Before commission" is honest in PERCENTAGE mode: the driver's pay really is
// derived from this number, so it's the base and the rate applies to it. In
// FIXED mode it is not — the fee is the fee whatever the fare — and a
// subtitle inviting the driver to take a percentage of RM 500 is precisely the
// mistake the fixed variant exists to prevent. So the sub-label steps aside and
// points at the fee card instead.
//
// Renders nothing when the job has no fare set. A fixed-fee job legitimately
// has none (fleetms decision D1 — a fee resolves whatever the fare), which is
// why the commission card is rendered independently of this one.
export function JobAmountCard({ amount, commission, style }: {
  amount: number | null | undefined;
  commission: SpecialCommission | null | undefined;
  style?: StyleProp<ViewStyle>;
}) {
  const T = useTokens();
  if (amount == null) return null;
  const isFixed = commission?.kind === 'fixed';
  return (
    <View style={[{
      backgroundColor: T.surface, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    }, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12, color: T.muted, fontWeight: '600' }}>Job amount</Text>
        <Text style={{ fontSize: 11, color: T.mutedLight }}>
          {isFixed ? "What the client pays — not your fee" : 'Before commission'}
        </Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '700', color: T.text, letterSpacing: -0.5 }}>
        RM {amount.toFixed(2)}
      </Text>
    </View>
  );
}
