import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTokens } from '../theme/ThemeProvider';

type Props = {
  /** Top-to-bottom instead of left-to-right. */
  vertical?: boolean;
  /** Corner radius, to match the parent. */
  radius?: number;
  testID?: string;
};

/** The green-to-lime accent gradient, filling its parent. Draw dark text on top (onGo). */
export function GoFill({ vertical, radius = 0, testID }: Props) {
  const T = useTokens();
  const id = `go${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View testID={testID} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
            <Stop offset="0" stopColor={T.goFrom}/>
            <Stop offset="1" stopColor={T.goTo}/>
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${id})`}/>
      </Svg>
    </View>
  );
}
