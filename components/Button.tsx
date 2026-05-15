import React from 'react';
import { Pressable, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Icon, IconName } from './Icon';
import { useTokens } from '../theme/ThemeProvider';

type Variant = 'primary' | 'green' | 'danger' | 'secondary' | 'ghost';

type Props = {
  variant?: Variant;
  children?: React.ReactNode;
  full?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  icon?: IconName;
  trailingIcon?: IconName;
  size?: 'md' | 'lg';
};

export function Button({
  variant = 'primary', children, full, onPress, style, icon, trailingIcon, size = 'md',
}: Props) {
  const T = useTokens();
  const variants: Record<Variant, { bg: string; fg: string; bd: string }> = {
    primary:   { bg: T.primary, fg: T.primaryFg, bd: T.primary },
    green:     { bg: T.green,   fg: '#FFFFFF',   bd: T.green },
    danger:    { bg: T.surface, fg: T.red,       bd: T.theme === 'dark' ? 'rgba(248,113,113,0.45)' : '#FCA5A5' },
    secondary: { bg: T.surface, fg: T.text,      bd: T.borderHard },
    ghost:     { bg: 'transparent', fg: T.muted, bd: 'transparent' },
  };
  const v = variants[variant];
  const minHeight = size === 'lg' ? 56 : 48;
  const fontSize = size === 'lg' ? 17 : 16;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: T.theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 18,
          paddingVertical: 14,
          minHeight,
          width: full ? '100%' : undefined,
          backgroundColor: v.bg,
          borderColor: v.bd,
          borderWidth: 1,
          borderRadius: 6,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={18} color={v.fg}/>}
      {typeof children === 'string'
        ? <Text style={{ color: v.fg, fontSize, fontWeight: '600', letterSpacing: -0.1 }}>{children}</Text>
        : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{children}</View>}
      {trailingIcon && <Icon name={trailingIcon} size={18} color={v.fg}/>}
    </Pressable>
  );
}
