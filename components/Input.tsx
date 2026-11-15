import React, { forwardRef, useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fontFor, radius, space } from '../theme/tokens';

type Props = TextInputProps & { invalid?: boolean };

/** Text field on the sunk surface. 2px ring: ink on focus, red when invalid. */
export const Input = forwardRef<TextInput, Props>(function Input({ invalid, style, onFocus, onBlur, multiline, ...rest }, ref) {
  const T = useTokens();
  const [focused, setFocused] = useState(false);
  const ring = invalid ? T.red : focused ? T.ink : 'transparent';
  return (
    <TextInput
      ref={ref}
      multiline={multiline}
      placeholderTextColor={T.text3}
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      style={[{
        backgroundColor: T.surfaceSunk,
        color: T.text,
        fontFamily: fontFor('500'),
        fontSize: 16,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: ring,
        paddingHorizontal: space[4],
      },
      multiline
        ? { minHeight: 96, paddingVertical: space[3], textAlignVertical: 'top' }
        : { height: 48 },
      style]}
    />
  );
});
