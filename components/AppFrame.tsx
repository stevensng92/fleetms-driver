import React from 'react';
import { ScrollView, View, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTokens } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

type Props = {
  bg?: string;
  children?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  /** Extra bottom padding to clear sticky CTAs and the floating tab bar. */
  bottomInset?: number;
};

// Mobile screen frame: safe areas + theme-aware background + optional scroll.
// The background is `ground`, the page colour behind the white cards. The
// floating tab bar sits below the scene (not over it), and the bottom padding
// keeps the last card clear of it either way.
export function AppFrame({ bg, children, contentStyle, scroll = true, bottomInset = space[6] }: Props) {
  const T = useTokens();
  const insets = useSafeAreaInsets();
  const background = bg ?? T.ground;
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
