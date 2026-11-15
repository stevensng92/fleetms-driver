import React from 'react';
import { Pressable, View, ViewStyle, StyleProp } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

type Props = {
  /** Legacy: the coloured left stripe. The design has none, so it is accepted and ignored. */
  accent?: string;
  /** Legacy: the breathing stripe. The design has no pulse, so it is accepted and ignored. */
  pulse?: boolean;
  /** Fades the card to 0.6. */
  dim?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
};

export function Card({ dim, children, style, onPress, testID }: Props) {
  const T = useTokens();
  const inner = (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: T.surface,
          borderRadius: radius.lg,
          boxShadow: T.shadow1,
          opacity: dim ? 0.6 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ borderRadius: radius.lg }}>
      {inner}
    </Pressable>
  );
}
