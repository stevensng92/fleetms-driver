import React from 'react';
import { Pressable, Text, View, ViewStyle, StyleProp } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon, IconName } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { EASE_OUT, motionFor, radius } from '../theme/tokens';

/** `green` and `ghost` are today's names: they now draw as `primary` and `quiet`. */
type Variant = 'primary' | 'secondary' | 'danger' | 'quiet' | 'green' | 'ghost';

type Props = {
  variant?: Variant;
  children?: React.ReactNode;
  full?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  icon?: IconName;
  trailingIcon?: IconName;
  size?: 'md' | 'lg';
  disabled?: boolean;
  testID?: string;
};

const CURVE = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

export function Button({
  variant = 'primary', children, full, onPress, style, icon, trailingIcon, size = 'md', disabled, testID,
}: Props) {
  const T = useTokens();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // The accent never fills a button (design rule), so legacy green is primary.
  const v = variant === 'green' ? 'primary' : variant === 'ghost' ? 'quiet' : variant;
  const look = {
    primary: { bg: T.ink, fg: T.onInk, shadow: undefined },
    secondary: { bg: T.surface, fg: T.text, shadow: T.shadow1 },
    danger: { bg: T.danger, fg: T.onColor, shadow: undefined },
    quiet: { bg: 'transparent', fg: T.text2, shadow: undefined },
  }[v];
  const lg = size === 'lg';
  const press = (to: number) => {
    scale.value = withTiming(to, { duration: 120, easing: CURVE });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={disabled ? undefined : () => press(motionFor(reduced).pressScale)}
      onPressOut={disabled ? undefined : () => press(1)}
      style={[{ width: full ? '100%' : undefined }, style]}
    >
      <Animated.View
        testID={testID}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: lg ? 24 : 20,
            minHeight: lg ? 52 : 44,
            backgroundColor: look.bg,
            borderRadius: radius.pill,
            boxShadow: look.shadow,
            opacity: disabled ? 0.4 : 1,
          },
          animated,
        ]}
      >
        {icon && <Icon name={icon} size={18} color={look.fg} testID={testID ? `${testID}-icon` : undefined}/>}
        {typeof children === 'string'
          ? <Text style={{ color: look.fg, fontSize: lg ? 16 : 14, fontWeight: '600', letterSpacing: -0.14 }}>{children}</Text>
          : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{children}</View>}
        {trailingIcon && <Icon name={trailingIcon} size={18} color={look.fg} testID={testID ? `${testID}-trailing-icon` : undefined}/>}
      </Animated.View>
    </Pressable>
  );
}
