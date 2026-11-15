import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { EASE_OUT, motionFor, radius, space, fontFor } from '../theme/tokens';
import { enterFrame } from '../lib/overlayMotion';

export type ToastTone = 'default' | 'success';
export type ToastItem = { id: number; text: string; tone: ToastTone };
type ShowOptions = { text: string; tone?: ToastTone; /** How long it stays. Default 3000; tests pass less. */ durationMs?: number };

// A tiny module-level store: one toast at a time, the newest replaces the older.
let current: ToastItem | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

export function showToast({ text, tone = 'default', durationMs = 3000 }: ShowOptions) {
  clearTimer();
  const item: ToastItem = { id: nextId++, text, tone };
  current = item;
  timer = setTimeout(() => dismissToast(item.id), durationMs);
  emit();
}

/** Clears the toast. Pass an id to clear only that toast (so a stale timer never removes a newer one). */
export function dismissToast(id?: number) {
  if (!current || (id !== undefined && current.id !== id)) return;
  clearTimer();
  current = null;
  emit();
}

export function getToast(): ToastItem | null {
  return current;
}

/** The toast on screen now, or null. */
export function useToasts(): ToastItem | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    getToast,
    getToast,
  );
}

/** Test helper: wipes the store. */
export function _resetToasts() {
  clearTimer();
  current = null;
  emit();
}

const EASING = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

/** Mount once in the root layout. Sits above the tab bar. */
export function ToastHost({ bottomOffset = 96 }: { bottomOffset?: number }) {
  const live = useToasts();
  const insets = useSafeAreaInsets();
  // The last toast stays drawn through its 120ms exit.
  const [shown, setShown] = useState<ToastItem | null>(live);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (live) {
      setShown(live);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const t = setTimeout(() => { setShown(null); setLeaving(false); }, 120);
    return () => clearTimeout(t);
  }, [live]);

  if (!shown) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: space[4], right: space[4], bottom: insets.bottom + bottomOffset, alignItems: 'center' }}>
      <ToastView key={shown.id} toast={shown} leaving={leaving}/>
    </View>
  );
}

function ToastView({ toast, leaving }: { toast: ToastItem; leaving: boolean }) {
  const T = useTokens();
  const reduced = useReducedMotion();
  const m = motionFor(reduced);
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(leaving ? 0 : 1, { duration: leaving ? m.fade1 : m.fade2, easing: EASING });
  }, [p, leaving, m.fade1, m.fade2]);

  const style = useAnimatedStyle(() => {
    const f = enterFrame(p.value, { reduced, rise: 8 });
    return { opacity: f.opacity, transform: [{ translateY: f.translateY }] };
  });

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[{
        flexDirection: 'row', alignItems: 'center', gap: space[2],
        backgroundColor: T.ink, borderRadius: radius.pill,
        paddingVertical: space[3], paddingHorizontal: space[4],
        boxShadow: T.shadow2, maxWidth: '100%',
      }, style]}
    >
      {toast.tone === 'success' ? (
        <View testID="toast-check"><Icon name="check" size={16} stroke={2.4} color={T.onInk}/></View>
      ) : null}
      <Text style={{ fontSize: 14, fontFamily: fontFor('600'), fontWeight: '600', color: T.onInk, flexShrink: 1 }}>{toast.text}</Text>
    </Animated.View>
  );
}
