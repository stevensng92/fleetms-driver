import React from 'react';
import { ScrollView, View, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTokens } from '../theme/ThemeProvider';

type Props = {
  bg?: string;
  children?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  /** Extra bottom padding to clear sticky CTAs / tab bars. */
  bottomInset?: number;
};

// Mobile screen frame: safe areas + theme-aware background + optional scroll.
// Use within an Expo Router screen; tab-screen variants (with a tab bar) get
// the extra bottom inset from the Tabs layout itself.
export function AppFrame({ bg, children, contentStyle, scroll = true, bottomInset = 24 }: Props) {
  const T = useTokens();
  const insets = useSafeAreaInsets();
  const background = bg ?? T.page;
  const padBottom = Math.max(bottomInset, insets.bottom);

  if (!scroll) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: background }}>
        <View style={[{ flex: 1, paddingBottom: padBottom }, contentStyle]}>
          {children}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[{ paddingBottom: padBottom }, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
