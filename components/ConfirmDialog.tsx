import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTokens } from '../theme/ThemeProvider';
import { EASE_OUT, motionFor, radius, space, type } from '../theme/tokens';
import { enterFrame } from '../lib/overlayMotion';
import { FormField } from './FormField';
import { Input } from './Input';

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  /** Names the act: "Mark done". */
  confirmLabel: string;
  /** The safe choice: "Keep job open". Never a bare "Cancel". */
  cancelLabel: string;
  tone?: 'default' | 'danger';
  /** Shows a multiline box; its trimmed text goes to onConfirm. A box that is not optional must be filled first. */
  reason?: { label: string; placeholder?: string; optional?: boolean };
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
};

const EASING = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

/** One confirm dialog for iOS and Android (replaces Alert.alert). Nothing fires until a button is pressed; the scrim and Android back count as keeping. */
export function ConfirmDialog({ visible, ...rest }: Props) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={rest.onCancel} statusBarTranslucent>
      <DialogBody {...rest}/>
    </Modal>
  );
}

function DialogBody({ title, body, confirmLabel, cancelLabel, tone = 'default', reason, onConfirm, onCancel }: Omit<Props, 'visible'>) {
  const T = useTokens();
  const reduced = useReducedMotion();
  const m = motionFor(reduced);
  const p = useSharedValue(0);
  const [text, setText] = useState('');

  useEffect(() => {
    p.value = withTiming(1, { duration: m.fade2, easing: EASING });
  }, [p, m.fade2]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const cardStyle = useAnimatedStyle(() => {
    const f = enterFrame(p.value, { reduced, scaleFrom: 0.97 });
    return { opacity: f.opacity, transform: [{ scale: f.scale }] };
  });

  const typed = text.trim();
  const blocked = !!reason && !reason.optional && typed === '';
  const confirmFill = tone === 'danger' ? T.danger : T.ink;
  const confirmText = tone === 'danger' ? T.onColor : T.onInk;

  const confirm = () => {
    if (blocked) return;
    onConfirm(reason ? typed : undefined);
  };

  const button = { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[4] } as const;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[5] }}>
      <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: T.scrim }, scrimStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onCancel} style={{ flex: 1 }}/>
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[{ width: '100%', maxWidth: 360, backgroundColor: T.surface, borderRadius: radius.lg, padding: space[6], gap: space[4], boxShadow: T.shadow2 }, cardStyle]}
      >
        <Text accessibilityRole="header" style={{ ...type.heading, color: T.text }}>{title}</Text>
        {body ? <Text style={{ ...type.body, color: T.text2 }}>{body}</Text> : null}
        {reason ? (
          <FormField label={reason.label}>
            <Input multiline value={text} onChangeText={setText} placeholder={reason.placeholder}/>
          </FormField>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[1] }}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={{ ...button, backgroundColor: T.surface, boxShadow: T.shadow1 }}
          >
            <Text style={{ ...type.title, color: T.text }}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: blocked }}
            onPress={confirm}
            style={{ ...button, backgroundColor: confirmFill, opacity: blocked ? 0.4 : 1 }}
          >
            <Text style={{ ...type.title, color: confirmText }}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
