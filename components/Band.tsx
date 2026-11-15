import React from 'react';
import { Text, View, ViewStyle, StyleProp } from 'react-native';
import { Icon, IconName } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import type { Tone } from '../lib/statusTone';

const DEFAULT_ICON: Record<Tone, IconName> = {
  amber: 'clock',
  red: 'circleAlert',
  neutral: 'info',
  blue: 'info',
  green: 'circleCheck',
};

type Props = {
  tone: Tone;
  children?: React.ReactNode;
  /** Defaults per tone: amber clock, red circle-alert, neutral and blue info, green circle-check. */
  icon?: IconName;
  /** A node on the right, such as a quiet button. */
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** A soft notice band: tone tint, tone text, always with an icon. */
export function Band({ tone, children, icon, action, style, testID }: Props) {
  const T = useTokens();
  const bg = tone === 'neutral' ? T.surfaceSunk : T[`${tone}Soft` as const];
  const fg = tone === 'neutral' ? T.text2 : T[`${tone}Text` as const];
  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: 'row', alignItems: 'flex-start', gap: 8,
          paddingVertical: 12, paddingHorizontal: 14,
          borderRadius: radius.md, backgroundColor: bg,
        },
        style,
      ]}
    >
      <View style={{ marginTop: 2 }}>
        <Icon name={icon ?? DEFAULT_ICON[tone]} size={16} color={fg} testID={testID ? `${testID}-icon` : undefined}/>
      </View>
      <View style={{ flex: 1 }}>
        {typeof children === 'string'
          ? <Text style={{ color: fg, fontSize: 14, fontWeight: '500', lineHeight: 20 }}>{children}</Text>
          : children}
      </View>
      {action ? <View testID={testID ? `${testID}-action` : undefined}>{action}</View> : null}
    </View>
  );
}
