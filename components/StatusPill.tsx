import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, Easing } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';

export type StatusKind =
  | 'pending' | 'confirmed' | 'progress' | 'done'
  | 'paid' | 'pendingPay' | 'voided';

export function StatusPill({ kind, pulse = false }: { kind: StatusKind; pulse?: boolean }) {
  const T = useTokens();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseAnim]);

  const map: Record<StatusKind, { bg: string; fg: string; dot: string; label: string }> = {
    pending:    { bg: T.pendingBg,  fg: T.pendingFg,  dot: T.pendingDot,  label: 'Pending' },
    confirmed:  { bg: T.confirmBg,  fg: T.confirmFg,  dot: T.confirmDot,  label: 'Confirmed' },
    progress:   { bg: T.progressBg, fg: T.progressFg, dot: T.progressDot, label: 'In Progress' },
    done:       { bg: T.doneBg,     fg: T.doneFg,     dot: T.doneDot,     label: 'Done' },
    paid:       { bg: T.doneBg,     fg: T.doneFg,     dot: T.doneDot,     label: 'Paid' },
    pendingPay: { bg: T.pendingBg,  fg: T.pendingFg,  dot: T.pendingDot,  label: 'Pending' },
    voided:     { bg: T.voidedBg,   fg: T.voidedFg,   dot: T.voidedDot,   label: 'Voided' },
  };
  const s = map[kind];

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
      gap: 6, paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 9999, backgroundColor: s.bg,
    }}>
      <Animated.View style={{
        width: 6, height: 6, borderRadius: 3, backgroundColor: s.dot,
        opacity: pulse ? pulseAnim : 1,
        transform: pulse ? [{ scale: pulseAnim.interpolate({ inputRange: [0.35, 1], outputRange: [0.85, 1] }) }] : undefined,
      }}/>
      <Text style={{ color: s.fg, fontSize: 12, fontWeight: '600', letterSpacing: 0.1 }}>
        {s.label}
      </Text>
    </View>
  );
}
