import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View, ViewStyle, StyleProp } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';

type Props = {
  accent?: string;
  dim?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** Gentle breathing animation on the accent stripe + the card border.
   *  Used to make in-progress jobs stand out in the Jobs list without being
   *  flashy. No-op when `accent` isn't set. */
  pulse?: boolean;
};

export function Card({ accent, dim, children, style, onPress, pulse }: Props) {
  const T = useTokens();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.55, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseAnim]);

  // We animate the left border by scaling its width 4 → 6 px (subtle), and
  // fade the colour slightly. useNativeDriver:false because layout width
  // isn't supported on the native driver — but 1100ms transitions on a
  // single non-scrollable view aren't a perf concern.
  const animatedBorderWidth = pulse
    ? pulseAnim.interpolate({ inputRange: [0.55, 1], outputRange: [4, 6] })
    : undefined;

  const inner = (
    <Animated.View
      style={[
        {
          backgroundColor: T.surface,
          borderRadius: 12,
          borderLeftWidth: pulse && accent ? (animatedBorderWidth as any) : (accent ? 4 : 0),
          borderLeftColor: accent ?? 'transparent',
          opacity: dim ? 0.6 : 1,
          shadowColor: T.theme === 'dark' ? '#000' : '#0F172A',
          shadowOpacity: T.theme === 'dark' ? 0.35 : 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: 'rgba(0,0,0,0.04)' }} style={{ borderRadius: 12 }}>
      {inner}
    </Pressable>
  );
}
