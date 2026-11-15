import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTokens } from '../theme/ThemeProvider';
import { EASE_OUT, motionFor, radius, space, type } from '../theme/tokens';
import { enterFrame } from '../lib/overlayMotion';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

const EASING = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

/** The one bottom sheet: scrim, panel with a grabber and optional title. Rises over 200ms; fades only under Reduce Motion. */
export function Sheet({ visible, onClose, title, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <SheetBody onClose={onClose} title={title}>{children}</SheetBody>
    </Modal>
  );
}

// Mounted per open, so the entrance always starts from 0.
function SheetBody({ onClose, title, children }: Omit<Props, 'visible'>) {
  const T = useTokens();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const m = motionFor(reduced);
  const [panelH, setPanelH] = useState(400);
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(1, { duration: m.fade2, easing: EASING });
  }, [p, m.fade2]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const panelStyle = useAnimatedStyle(() => {
    const f = enterFrame(p.value, { reduced, rise: panelH });
    return { opacity: f.opacity, transform: [{ translateY: f.translateY }] };
  });

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: T.scrim }, scrimStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }}/>
      </Animated.View>
      <Animated.View
        onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
        style={[{
          backgroundColor: T.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingHorizontal: space[5],
          paddingTop: space[3],
          paddingBottom: insets.bottom + space[5],
        }, panelStyle]}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill, backgroundColor: T.track, marginBottom: space[3] }}/>
        {title ? (
          <Text accessibilityRole="header" style={{ ...type.heading, color: T.text, marginBottom: space[3] }}>{title}</Text>
        ) : null}
        {children}
      </Animated.View>
    </View>
  );
}
