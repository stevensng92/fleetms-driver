import React from 'react';
import { Text, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { useOnFeature } from './FeatureCard';
import { useTokens } from '../theme/ThemeProvider';
import { radius, fontFor } from '../theme/tokens';
import type { Tone } from '../lib/statusTone';

/** The tint and text colour of a tone, on the page or on the dark feature card. */
export function useToneColors(tone: Tone, onFeature?: boolean) {
  const T = useTokens();
  const inherited = useOnFeature();
  const on = onFeature ?? inherited;
  const src = on ? T.onFeatureStatus : T;
  return {
    bg: src[`${tone}Soft` as const],
    fg: src[`${tone}Text` as const],
    onFeature: on,
  };
}

type ShellProps = {
  bg: string;
  fg: string;
  icon?: IconName | null;
  struck?: boolean;
  children: React.ReactNode;
  testID?: string;
};

/** The 24px pill body: icon (13px) plus a 12px semibold word. Shared by Pill and StatusPill. */
export function PillShell({ bg, fg, icon, struck, children, testID }: ShellProps) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        height: 24, gap: 4, paddingLeft: 8, paddingRight: 12,
        borderRadius: radius.pill, backgroundColor: bg,
      }}
    >
      {icon ? <View testID={testID ? `${testID}-icon` : undefined}><Icon name={icon} size={13} stroke={2.6} color={fg}/></View> : null}
      <Text
        style={{
          color: fg, fontSize: 12, fontFamily: fontFor('600'), fontWeight: '600', lineHeight: 16,
          textDecorationLine: struck ? 'line-through' : 'none',
        }}
      >
        {children}
      </Text>
    </View>
  );
}

type Props = {
  tone?: Tone;
  children: React.ReactNode;
  icon?: IconName;
  /** Use the dark-card tints. Left out, it follows whether it sits in a FeatureCard. */
  onFeature?: boolean;
  testID?: string;
};

/** A plain tone pill for things that are not statuses: "New", "Default", "RM 80 flat". */
export function Pill({ tone = 'neutral', children, icon, onFeature, testID }: Props) {
  const c = useToneColors(tone, onFeature);
  return <PillShell bg={c.bg} fg={c.fg} icon={icon} testID={testID}>{children}</PillShell>;
}
