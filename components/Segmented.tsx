import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { radius, fontFor } from '../theme/tokens';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Stretch to the full width, segments sharing it equally. */
  block?: boolean;
};

/** Pill track; the chosen segment is a raised white pill. */
export function Segmented<T extends string>({ options, value, onChange, block }: Props<T>) {
  const T_ = useTokens();
  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: T_.track,
        alignSelf: block ? 'stretch' : 'flex-start',
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={{
              ...(block ? { flex: 1 } : {}),
              minHeight: 38, paddingHorizontal: 16, borderRadius: radius.pill,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? T_.surface : 'transparent',
              ...(on ? { boxShadow: T_.shadow1 } : {}),
            }}
          >
            <Text style={{ fontSize: 14, fontFamily: fontFor((on ? '600' : '500') as '500' | '600' | '700'), fontWeight: on ? '600' : '500', color: on ? T_.text : T_.text2 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
