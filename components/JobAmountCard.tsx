import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Card } from './Card';
import { CommissionRateCard } from './CommissionRateCard';
import { useTokens } from '../theme/ThemeProvider';
import { fontFor, space, type, TABULAR } from '../theme/tokens';
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
//
// `bare` draws the row without its card, for PayCard below.
export function JobAmountCard({ amount, commission, style, bare }: {
  amount: number | null | undefined;
  commission: SpecialCommission | null | undefined;
  style?: StyleProp<ViewStyle>;
  bare?: boolean;
}) {
  const T = useTokens();
  if (amount == null) return null;
  const isFixed = commission?.kind === 'fixed';
  const row = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[4] }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[type.body, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text }]}>Job amount</Text>
        <Text style={[type.label, { color: T.text2 }]}>
          {isFixed ? "What the client pays, not your fee" : 'Before commission'}
        </Text>
      </View>
      <Text style={[type.figure, TABULAR, { color: T.text }]}>
        RM {amount.toFixed(2)}
      </Text>
    </View>
  );
  if (bare) return row;
  return <Card style={[{ padding: space[5] }, style]}>{row}</Card>;
}

// The fare and, when the job pays something other than the driver's normal
// cut, that pay under it, in ONE card with a hairline between (as the redesign
// draws it). Renders nothing when there is neither.
export function PayCard({ amount, commission, style }: {
  amount: number | null | undefined;
  commission: SpecialCommission | null | undefined;
  style?: StyleProp<ViewStyle>;
}) {
  const T = useTokens();
  if (amount == null && commission == null) return null;
  return (
    <Card style={[{ padding: space[5] }, style]}>
      <JobAmountCard amount={amount} commission={commission} bare/>
      <CommissionRateCard
        commission={commission}
        bare
        style={amount != null ? { marginTop: space[4], paddingTop: space[4], borderTopWidth: 1, borderTopColor: T.hairline } : undefined}
      />
    </Card>
  );
}
