import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function AppHeader({ title, subtitle, onBack, right }: Props) {
  const T = useTokens();
  return (
    <View style={{
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 14,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: T.ground,
    }}>
      {onBack && (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: 44, height: 44, marginLeft: -10, marginTop: -6,
            borderRadius: 9999, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="chevL" size={26} stroke={2.2} color={T.text}/>
        </Pressable>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{
          fontSize: 28, fontWeight: '700', color: T.text,
          letterSpacing: -0.56, lineHeight: 32,
        }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ marginTop: 4, fontSize: 14, color: T.text2, fontWeight: '500' }}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

// Section heading used between cards in the scroll views. Sentence case.
export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const T = useTokens();
  return (
    <View style={{
      // 'center' (not 'baseline'): the right slot may contain a Pressable with
      // an Icon, which has no text baseline — RN can't align properly and the
      // action sits visibly above the label otherwise.
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10,
    }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: T.text }}>
        {children}
      </Text>
      {right}
    </View>
  );
}
