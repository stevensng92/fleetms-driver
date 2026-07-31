import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { formatRatePct } from '../lib/commissionRate';

// "20% comm" — the badge for a job whose commission rate differs from the
// driver's normal org rate. Shared by the Jobs list (JobCard) and Earnings so
// the same fact never renders two different ways.
//
// Red-tinted rather than neutral: a non-standard rate is the one number on the
// card a driver should stop and read before accepting, and the old neutral
// chip (T.raised on T.border) disappeared into the card it sat on. redSoft is
// a light tint in both themes — it draws the eye without reading as an error
// the way a solid red fill would.
//
// Borderless on purpose, matching StatusPill and the overdue PICKUP chip: a
// hard outline would make this louder than the "MISSED" overdue state sitting
// next to it on the same card, which is the more urgent signal.
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
  style?: any;
}) {
  const T = useTokens();
  if (pct == null) return null;
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
      backgroundColor: T.redSoft, flexShrink: 0,
    }, style]}>
      <Icon name="wallet" size={11} color={T.redFg}/>
      {/* One line, always. In the Earnings row this sits in a column that
          shares width with the amount and the status pill, and "20% comm"
          breaking to "20% / comm" on a narrow phone looks broken. */}
      <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: T.redFg }}>
        {formatRatePct(pct)}{compact ? '' : ' comm'}
      </Text>
    </View>
  );
}
