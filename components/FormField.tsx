import React from 'react';
import { Text, View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { space, fontFor } from '../theme/tokens';

type Props = {
  label: string;
  hint?: string;
  /** Replaces the hint. */
  error?: string;
  required?: boolean;
  children: React.ReactNode;
};

/** Label above, the control, then the hint or the error under it. */
export function FormField({ label, hint, error, required, children }: Props) {
  const T = useTokens();
  return (
    <View style={{ gap: space[2] }}>
      <Text style={{ fontSize: 13, fontFamily: fontFor('500'), fontWeight: '500', color: T.text2 }}>
        {label}
        {required ? <Text style={{ color: T.redText }}>*</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fontFor('500'), fontSize: 12, color: T.redText }}>{error}</Text>
      ) : hint ? (
        <Text style={{ fontFamily: fontFor('500'), fontSize: 12, color: T.text3 }}>{hint}</Text>
      ) : null}
    </View>
  );
}
