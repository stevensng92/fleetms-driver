import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { PillShell, useToneColors } from './Pill';
import { statusTone, StatusToneResult } from '../lib/statusTone';
import { useTokens } from '../theme/ThemeProvider';
import { EASE_OUT, motionFor, radius, withAlpha } from '../theme/tokens';

/** Today's kinds, still accepted so existing screens keep compiling. */
export type StatusKind =
  | 'pending' | 'confirmed' | 'progress' | 'done'
  | 'paid' | 'pendingPay' | 'voided';

type NewProps = {
  kind: 'job' | 'payment';
  /** The raw status: "in_progress", "In Progress", "paid"... */
  status: string;
  /** Use the dark-card tints. Left out, it follows whether it sits in a FeatureCard. */
  onFeature?: boolean;
  pulse?: boolean;
};
type LegacyProps = {
  kind: StatusKind;
  status?: undefined;
  onFeature?: boolean;
  /** Accepted and ignored: the glow now belongs to In Progress itself. */
  pulse?: boolean;
};
type Props = NewProps | LegacyProps;

type Resolved = StatusToneResult & { live: boolean };

/** Today's words, drawn in the new style. */
function resolveLegacy(kind: StatusKind): StatusToneResult {
  switch (kind) {
    case 'pending': return statusTone('job', 'pending');
    case 'confirmed': return statusTone('job', 'confirmed');
    case 'progress': return statusTone('job', 'in_progress');
    case 'done': return statusTone('job', 'done');
    case 'paid': return statusTone('payment', 'paid');
    case 'pendingPay': return { ...statusTone('payment', 'unpaid'), label: 'Pending' };
    case 'voided': return { tone: 'neutral', label: 'Voided', icon: 'ban' };
  }
}

function resolve(props: Props): Resolved {
  const isNew = props.status !== undefined;
  const s = isNew
    ? statusTone(props.kind as 'job' | 'payment', props.status as string)
    : resolveLegacy(props.kind as StatusKind);
  const live = s.tone === 'blue' && s.label === 'In Progress';
  return { ...s, live };
}

/** The look at `progress` (0 to 1) of the settle: fade up from 0.4, scale up from 0.96. Reduce Motion: fade only. */
export function settleFrame(progress: number, reduced: boolean) {
  'worklet';
  return {
    opacity: 0.4 + 0.6 * progress,
    scale: reduced ? 1 : 0.96 + 0.04 * progress,
  };
}

const CURVE = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

/** The slow blue halo behind an In Progress pill: 1.2s up, 1.2s down, forever (2.4s a cycle). */
function Glow() {
  const T = useTokens();
  const reduced = useReducedMotion();
  const v = useSharedValue(0);

  useEffect(() => {
    if (reduced) return undefined;
    v.value = 0;
    v.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(v);
  }, [reduced, v]);

  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  const boxShadow = reduced
    ? `0px 0px 0px 2px ${withAlpha(T.blue, 0.25)}`
    : `0px 0px 0px 3px ${withAlpha(T.blue, 0.18)}, 0px 0px 14px 2px ${withAlpha(T.blue, 0.4)}`;

  return (
    <Animated.View
      testID="status-glow"
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.pill, boxShadow }, reduced ? { opacity: 1 } : style]}
    />
  );
}

export function StatusPill(props: Props) {
  const T = useTokens();
  const reduced = useReducedMotion();
  const s = resolve(props);
  const c = useToneColors(s.tone, props.onFeature);

  // A changed status settles once. Never on the first draw.
  const key = `${s.tone}|${s.label}`;
  const last = useRef(key);
  const settle = useSharedValue(1);
  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    settle.value = 0;
    settle.value = withTiming(1, { duration: motionFor(reduced).fade2, easing: CURVE });
  }, [key, reduced, settle]);
  const settleStyle = useAnimatedStyle(() => {
    const f = settleFrame(settle.value, reduced);
    return { opacity: f.opacity, transform: [{ scale: f.scale }] };
  });

  let fg = c.fg;
  if (s.done) fg = c.onFeature ? T.onFeature : T.text;
  if (s.struck) fg = c.onFeature ? T.onFeature2 : T.text2;

  return (
    <View style={{ alignSelf: 'flex-start' }}>
      {s.live ? <Glow/> : null}
      <Animated.View style={[{ transformOrigin: 'left center' }, settleStyle]}>
        <PillShell testID="status-pill" bg={c.bg} fg={fg} icon={s.icon} struck={s.struck}>{s.label}</PillShell>
      </Animated.View>
    </View>
  );
}
