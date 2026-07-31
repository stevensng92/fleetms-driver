import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { formatRatePct } from '../lib/commissionRate';

// "20% comm" — the badge for a job whose commission rate differs from the
// driver's normal org rate. Shared by the Jobs list (JobCard) and Earnings so
// the same fact never renders two different ways.
//
// Cyan (accentSoft/accentFg), deliberately NOT red.
//
// This shipped briefly as red and that was wrong. Every other redSoft+redFg
// surface in the app is a failure state — the MISSED overdue chip, REJECTED and
// VOIDED expenses, the force-update lockout, every ErrorBox. But resolveSpecialRate
// fires whenever a rate DIFFERS in either direction, so a job paying 20% against
// a 15% default is MORE money wearing the app's error colour. Worse, on an
// overdue card the pill sat 6px under the MISSED block in an identical tint, so
// "you missed this pickup" and "this job pays 20%" looked like the same class of
// thing. Amber was the other candidate but already means "pending" here
// (StatusPill, and the awaiting-commission banner on Earnings); cyan carries no
// pre-existing verdict, which is right for a fact that is neither good nor bad
// until the driver reads the number.
//
// Borderless, matching StatusPill and the overdue PICKUP chip.
//
// `compact` drops the trailing "comm" for callers that already sit under a
// label saying so — CommissionRateCard's row reads "Commission rate … 20% comm"
// otherwise, which says commission twice. Standalone callers (Jobs list,
// Earnings rows) keep the word, because there the pill is the only thing
// naming what the number is.
//
// Renders nothing when `pct` is null, so callers can drop it in unguarded.
export function CommissionPill({ pct, compact, style }: {
  pct: number | null | undefined;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const T = useTokens();
  if (pct == null) return null;
  return (
    // alignSelf sits in the DEFAULT block so `style` can override it. Inside
    // CommissionRateCard the parent row is alignItems:'center' against a
    // two-line label, and a hardcoded flex-start left the pill sitting high.
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
      backgroundColor: T.accentSoft, flexShrink: 0,
    }, style]}>
      <Icon name="wallet" size={11} color={T.accentFg}/>
      {/* One line, always. In the Earnings row this sits in a column that
          shares width with the amount and the status pill, and "20% comm"
          breaking to "20% / comm" on a narrow phone looks broken. */}
      <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: T.accentFg }}>
        {formatRatePct(pct)}{compact ? '' : ' comm'}
      </Text>
    </View>
  );
}
