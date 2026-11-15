import React, { createContext, useContext } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

// The one dark card. It stays dark in both themes, so anything drawn on it
// (pills, text) needs the on-feature colours. A small context tells children
// they are on it, so StatusPill and Pill pick the dark tints without a prop.
const OnFeatureCtx = createContext(false);

/** True when rendered inside a FeatureCard. */
export function useOnFeature(): boolean {
  return useContext(OnFeatureCtx);
}

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function FeatureCard({ children, style, testID }: Props) {
  const T = useTokens();
  return (
    <OnFeatureCtx.Provider value>
      <View
        testID={testID}
        style={[
          {
            backgroundColor: T.feature,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: T.featureEdge,
            padding: 20,
          },
          style,
        ]}
      >
        {children}
      </View>
    </OnFeatureCtx.Provider>
  );
}
