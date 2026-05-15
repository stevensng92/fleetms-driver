import React from 'react';
import { Pressable, View, ViewStyle, StyleProp } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';

type Props = {
  accent?: string;
  dim?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export function Card({ accent, dim, children, style, onPress }: Props) {
  const T = useTokens();
  const inner = (
    <View
      style={[
        {
          backgroundColor: T.surface,
          borderRadius: 12,
          borderLeftWidth: accent ? 4 : 0,
          borderLeftColor: accent ?? 'transparent',
          opacity: dim ? 0.6 : 1,
          // RN shadow (iOS) + elevation (Android) — keep both subtle to match the prototype.
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
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: 'rgba(0,0,0,0.04)' }} style={{ borderRadius: 12 }}>
      {inner}
    </Pressable>
  );
}
