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
      backgroundColor: T.page,
    }}>
      {onBack && (
        <Pressable
          onPress={onBack}
          style={{
            width: 40, height: 40, marginLeft: -8, marginTop: -4,
            borderRadius: 9999, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="chevL" size={26} stroke={2.2} color={T.text}/>
        </Pressable>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{
          fontSize: 26, fontWeight: '700', color: T.text,
          letterSpacing: -0.6, lineHeight: 30,
        }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ marginTop: 4, fontSize: 14, color: T.muted, fontWeight: '500' }}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

// Compact section label used between cards in the scroll views.
export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const T = useTokens();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10,
    }}>
      <Text style={{
        fontSize: 12, fontWeight: '700', color: T.muted,
        letterSpacing: 0.8, textTransform: 'uppercase',
      }}>
        {children}
      </Text>
      {right}
    </View>
  );
}
