import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Card } from './Card';
import { CommissionPill } from './CommissionPill';
import { useTokens } from '../theme/ThemeProvider';
import { fontFor, space, type } from '../theme/tokens';
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
//
// `bare` draws the row without its card, for PayCard (JobAmountCard.tsx), which
// stacks it under the fare in one card.
export function CommissionRateCard({ commission, style, bare }: {
  commission: SpecialCommission | null | undefined;
  style?: StyleProp<ViewStyle>;
  bare?: boolean;
}) {
  const T = useTokens();
  if (commission == null) return null;
  const isFixed = commission.kind === 'fixed';
  const row = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }, bare ? style : null]}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[type.body, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text }]}>
          {isFixed ? 'Your fee for this job' : 'Commission rate'}
        </Text>
        {/* text2, not text3: this is the only line telling a driver the figure
            isn't an error, so it keeps the stronger of the two greys. */}
        <Text style={[type.label, { color: T.text2 }]}>
          {isFixed
            ? 'Flat fee — not a percentage of the fare'
            : 'Different from your usual rate'}
        </Text>
      </View>
      <CommissionPill commission={commission} compact/>
    </View>
  );
  if (bare) return row;
  return <Card style={[{ padding: space[5] }, style]}>{row}</Card>;
}
