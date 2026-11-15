import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTokens } from '../theme/ThemeProvider';
import { fontFor } from '../theme/tokens';

// FleetMS "Chevron" logomark, same geometry as the mock's FleetMSMark and the
// dispatcher web's `public/fleetms-mark.svg`. Three chevrons brightening left
// to right on the dark feature square; the leading one is the system green
// (it was violet before the redesign). The square is dark in both themes.
export function Logo({ size = 56 }: { size?: number }) {
  const T = useTokens();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x={1} y={1} width={30} height={30} rx={8} fill={T.feature} stroke={T.featureEdge} strokeWidth={1}/>
      <Path d="M7 10 L14 16 L7 22"   stroke={T.onFeature} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.35}/>
      <Path d="M13 10 L20 16 L13 22" stroke={T.onFeature} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.65}/>
      <Path d="M19 10 L26 16 L19 22" stroke={T.go}        strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

export function Wordmark({ size = 22, color, muted }: { size?: number; color?: string; muted?: string }) {
  const T = useTokens();
  const spacing = Math.round(size * -0.02 * 100) / 100;
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={{
        fontFamily: fontFor('700'), fontWeight: '700', fontSize: size, letterSpacing: spacing, lineHeight: size * 1.05,
        color: color ?? T.text,
      }}>
        Fleet
      </Text>
      <Text style={{
        fontFamily: fontFor('500'), fontWeight: '500', fontSize: size, letterSpacing: spacing, lineHeight: size * 1.05,
        color: muted ?? T.text2,
      }}>
        MS
      </Text>
    </View>
  );
}
