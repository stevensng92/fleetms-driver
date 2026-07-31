import React from 'react';
import { View, Text } from 'react-native';
import { CommissionPill } from './CommissionPill';
import { useTokens } from '../theme/ThemeProvider';

// Detail-screen treatment of a non-default commission rate, shared by Job
// Detail and Active Job.
//
// Why a card here when the Jobs list and Earnings use a bare pill: those are
// scan surfaces where the rate is one fact among many, while a detail screen
// is where a driver stops to work out what they're actually being paid. The
// card carries the "why should I care" line that the pill has no room for.
// The value itself is still the pill, so the same fact reads the same way
// everywhere — only the surrounding explanation changes.
//
// No leading wallet icon on the card: the pill already carries one, and two
// wallets in one row reads like a rendering bug.
//
// Renders nothing when the job pays the standard rate.
export function CommissionRateCard({ pct, style }: { pct: number | null | undefined; style?: any }) {
  const T = useTokens();
  if (pct == null) return null;
  return (
    <View style={[{
      backgroundColor: T.surface, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    }, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13, color: T.text, fontWeight: '600' }}>Commission rate</Text>
        <Text style={{ fontSize: 11, color: T.mutedLight }}>Different from your usual rate</Text>
      </View>
      <CommissionPill pct={pct} compact/>
    </View>
  );
}
