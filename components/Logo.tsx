import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTokens } from '../theme/ThemeProvider';

// FleetMS "Chevron" logomark — exact match for the dispatcher web's
// `public/fleetms-mark.svg` so the driver app and fleetms.my share the same
// brand mark. Three chevrons fading; the leading one uses the purple accent.
export function Logo({ size = 56, bg = '#0F172A', fg = '#FFFFFF', accent = '#8B5CF6' }: {
  size?: number; bg?: string; fg?: string; accent?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x={1} y={1} width={30} height={30} rx={8} fill={bg} stroke="rgba(255,255,255,0.22)" strokeWidth={1}/>
      <Path d="M7 10 L14 16 L7 22"   stroke={fg}     strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.35}/>
      <Path d="M13 10 L20 16 L13 22" stroke={fg}     strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.65}/>
      <Path d="M19 10 L26 16 L19 22" stroke={accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

export function Wordmark({ size = 22, color, muted }: { size?: number; color?: string; muted?: string }) {
  const T = useTokens();
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={{
        fontWeight: '700', fontSize: size, letterSpacing: -0.5, lineHeight: size * 1.05,
        color: color ?? T.text,
      }}>
        Fleet
      </Text>
      <Text style={{
        fontWeight: '500', fontSize: size, letterSpacing: -0.5, lineHeight: size * 1.05,
        color: muted ?? T.muted,
      }}>
        MS
      </Text>
    </View>
  );
}
