import React from 'react';
import { Text, ViewStyle, StyleProp } from 'react-native';
import { Band } from './Band';
import { Button } from './Button';
import { errorWords } from '../lib/errorWords';
import { useTokens } from '../theme/ThemeProvider';
import { space, type } from '../theme/tokens';

/**
 * The one "Couldn't load …" box: a red band with the screen's title, the
 * technical message under it, and Retry in the band's own action slot.
 * Anything passed as children shows under the message.
 */
export function LoadError({ title, error, onRetry, children, style }: {
  title: string;
  /** Whatever was thrown. Shown only through errorWords, never as its own text. */
  error: unknown;
  onRetry: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const T = useTokens();
  return (
    <Band
      tone="red"
      style={[{ marginHorizontal: space[4] }, style]}
      action={<Button variant="secondary" onPress={onRetry}>Retry</Button>}
    >
      <Text style={[type.title, { color: T.redText, marginBottom: space[1] }]}>{title}</Text>
      <Text style={[type.label, { color: T.redText }]}>{errorWords(error)}</Text>
      {children}
    </Band>
  );
}
