import React from 'react';
import { Text } from 'react-native';
import Animated, { useReducedMotion, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { render, screen } from '@testing-library/react-native';

// Guards the reanimated wiring in test/setup.ts: shared pieces (StatusPill's
// glow, Sheet, Toast, the fold) animate with reanimated, and their tests must
// render without a native runtime.
function Probe() {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  v.value = withTiming(1, { duration: 200 });
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View style={style}>
      <Text>{reduced ? 'reduced' : 'full'}</Text>
    </Animated.View>
  );
}

it('renders a reanimated view in tests', async () => {
  await render(<Probe/>);
  expect(screen.getByText(/reduced|full/)).toBeTruthy();
});
