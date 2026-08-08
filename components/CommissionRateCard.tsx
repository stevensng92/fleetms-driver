import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { CommissionPill } from './CommissionPill';
import { useTokens } from '../theme/ThemeProvider';
import type { SpecialCommission } from '../lib/commissionRate';

// Detail-screen treatment of non-standard pay, shared by Job Detail and Active
// Job. (Named for the rate because that was the only mode when it shipped; it
// now covers flat fees too.)
//
// Why a card here when the Jobs list and Earnings use a bare pill: those are
// scan surfaces where pay is one fact among many, while a detail screen is
// where a driver stops to work out what they're actually being paid. The card
// carries the "why should I care" line that the pill has no room for. The value
// itself is still the pill, so the same fact reads the same way everywhere —
// only the surrounding explanation changes.
//
// The FIXED caption is the whole point of the fixed mode existing. A flat fee
// renders in a slot a driver has learned means "percentage", on a screen whose
// other number is the client's fare — so the caption has to say, in words, that
// the fare is not the thing their pay comes out of. Without it a RM 80 fee on a
// RM 500 job is read as the org's ~20%, which is RM 100.
//
// No leading wallet icon on the card: the pill already carries one, and two
// wallets in one row reads like a rendering bug.
//
// Renders nothing when the job pays the driver's normal rate.
export function CommissionRateCard({ commission, style }: {
  commission: SpecialCommission | null | undefined;
  style?: StyleProp<ViewStyle>;
}) {
  const T = useTokens();
  if (commission == null) return null;
  const isFixed = commission.kind === 'fixed';
  return (
    <View style={[{
      backgroundColor: T.surface, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    }, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13, color: T.text, fontWeight: '600' }}>
          {isFixed ? 'Your fee for this job' : 'Commission rate'}
        </Text>
        {/* T.muted, not T.mutedLight: this is the only line telling a driver the
            figure isn't an error, and mutedLight computes 2.56:1 on light /
            3.57:1 on dark at 11px — both below the WCAG AA 4.5:1 floor. */}
        <Text style={{ fontSize: 11, color: T.muted }}>
          {isFixed
            ? 'Flat fee — not a percentage of the fare'
            : 'Different from your usual rate'}
        </Text>
      </View>
      <CommissionPill commission={commission} compact/>
    </View>
  );
}
