import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Card } from './Card';
import { FeatureCard } from './FeatureCard';
import { StatusPill } from './StatusPill';
import { Button } from './Button';
import { GoFill } from './GoFill';
import { Icon } from './Icon';
import { CommissionPill } from './CommissionPill';
import { useTokens } from '../theme/ThemeProvider';
import { EASE_OUT, fontFor, motionFor, radius, space, type, TABULAR } from '../theme/tokens';
import type { SpecialCommission } from '../lib/commissionRate';
import { jobStatus } from '../lib/jobStatus';

export type Job = {
  /** Human-readable identifier from jobs.job_number, shown on cards. */
  id: string;
  /** DB primary key; required for status-change mutations. Optional on mock data. */
  jobUuid?: string;
  /** Current assignment uuid; required for confirm/reject mutations. */
  assignmentId?: string;
  time: string;
  /** "Thu, 2 Jul" — the pickup's calendar date. Only shown when `overdue`. */
  pickupDate?: string;
  vehicle: string;
  from: string;
  to: string;
  client: string;
  pax: number;
  /** The job status as the dispatcher sends it ("in_progress"). Read it through lib/jobStatus.ts. */
  status: string;
  /** The real pickup time (ISO). Orders today's jobs on the Jobs tab. */
  pickupAt?: string;
  /** What this job pays when it isn't the driver's normal cut — a rate
   *  (20 → "20% comm") or a flat fee (80 → "RM 80 flat"). null = pays the
   *  standard rate, so no badge renders. Resolved in lib/commissionRate.ts —
   *  a rate override pinned to the default is deliberately NOT special. */
  specialCommission?: SpecialCommission | null;
};

const CURVE = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';

/** From and to, with the pin column the admin route band uses: an ink ring, then the green pin. */
export function RouteLine({ from, to, onFeature }: { from: string; to: string; onFeature: boolean }) {
  const T = useTokens();
  const place = { ...type.body, color: onFeature ? T.onFeature : T.text, flex: 1 } as const;
  return (
    <View style={{ gap: space[2] }}>
      {/* the line between the two pins */}
      <View style={{
        position: 'absolute', left: 5, top: 12, bottom: 12, width: 2,
        backgroundColor: onFeature ? T.featureTrack : T.hairlineStrong,
      }}/>
      <View accessible accessibilityLabel={`From ${from}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{
          width: 12, height: 12, borderRadius: 6, borderWidth: 2,
          backgroundColor: onFeature ? T.feature : T.surface,
          borderColor: onFeature ? T.onFeature : T.ink,
        }}/>
        <Text style={place} numberOfLines={1}>{from}</Text>
      </View>
      <View accessible accessibilityLabel={`To ${to}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, overflow: 'hidden' }}>
          <GoFill radius={6}/>
        </View>
        <Text style={place} numberOfLines={1}>{to}</Text>
      </View>
    </View>
  );
}

/** Pax, plate and job number as separate items, each with its own icon where it has one. */
function Meta({ job, onFeature }: { job: Job; onFeature: boolean }) {
  const T = useTokens();
  const color = onFeature ? T.onFeature2 : T.text2;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space[4], rowGap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
        <Icon name="users" size={14} stroke={2.2} color={color}/>
        <Text style={[type.label, { color }]}>{job.pax} pax</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], flexShrink: 1 }}>
        <Icon name="car" size={14} stroke={2.2} color={color}/>
        <Text style={[type.label, { color, fontFamily: MONO }]} numberOfLines={1}>{job.vehicle}</Text>
      </View>
      <Text style={[type.caption, TABULAR, { color, fontFamily: fontFor('600'), fontWeight: '600', marginLeft: 'auto' }]}>
        {job.id}
      </Text>
    </View>
  );
}

export function JobCard({
  job, dim, overdue, hideActions, onAccept, onReject, onPress,
}: {
  job: Job;
  dim?: boolean;
  /** Pickup already passed on a previous day and the job is still open.
   *  Swaps in a red "Missed, <date>" line so it can't be mistaken for a job
   *  scheduled today. */
  overdue?: boolean;
  hideActions?: boolean;
  /** Called once the buttons have faded. Return (or resolve to) `false` when the accept
   *  failed, and the buttons come back. */
  onAccept?: () => void | boolean | Promise<boolean | void>;
  onReject?: () => void;
  onPress?: () => void;
}) {
  const T = useTokens();
  const reduced = useReducedMotion();
  const status = jobStatus(job.status);
  // The job being driven is the one dark card on the screen.
  const live = status.live;

  // Accept: a light success haptic on the tap, then the two buttons fade out
  // (120ms, opacity only) and stop taking taps, then accept fires once. The
  // pill settles on its own when the job turns Confirmed.
  const [accepting, setAccepting] = useState(false);
  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  // A ref as well as the state: two taps can land before React has re-rendered.
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const accept = () => {
    if (locked.current) return;
    locked.current = true;
    setAccepting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const ms = motionFor(reduced).fade1;
    fade.value = withTiming(0, { duration: ms, easing: CURVE });
    timer.current = setTimeout(async () => {
      let ok: boolean | void = true;
      try { ok = await onAccept?.(); } catch { ok = false; }
      if (ok === false) {
        fade.value = withTiming(1, { duration: ms, easing: CURVE });
        locked.current = false;
        setAccepting(false);
      }
    }, ms);
  };

  const ink = live ? T.onFeature : T.text;
  const main = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${job.id}, ${job.client}, pickup ${job.time}${overdue && job.pickupDate ? `, missed on ${job.pickupDate}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({
        gap: space[3],
        paddingVertical: space[4], paddingHorizontal: space[5],
        borderRadius: live ? radius.xl : radius.lg,
        transform: [{ scale: pressed ? motionFor(reduced).pressScale : 1 }],
      })}
    >
      {/* Top row: pickup time, the missed date when overdue, status pill */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minWidth: 0 }}>
        <Text style={[type.heading, TABULAR, { color: ink }]}>{job.time}</Text>
        {overdue && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], flexShrink: 1 }}>
            <Icon name="triangleAlert" size={14} stroke={2.4} color={T.redText}/>
            <Text style={[type.label, { color: T.redText, fontFamily: fontFor('600'), fontWeight: '600' }]} numberOfLines={1}>
              {job.pickupDate ? `Missed, ${job.pickupDate}` : 'Missed'}
            </Text>
          </View>
        )}
        <View style={{ marginLeft: 'auto' }}>
          <StatusPill kind="job" status={job.status}/>
        </View>
      </View>

      <Text style={[type.title, { color: ink }]} numberOfLines={1}>{job.client}</Text>

      <RouteLine from={job.from} to={job.to} onFeature={live}/>
      <Meta job={job} onFeature={live}/>

      {/* Non-default pay. Its own row rather than another chip in the
          crowded meta line above — it only appears on the handful of jobs
          that carry one, and a pay figure shouldn't be the thing that gets
          truncated on a narrow phone. */}
      <CommissionPill commission={job.specialCommission}/>
    </Pressable>
  );

  if (live) {
    return (
      <FeatureCard style={{ padding: 0, marginHorizontal: space[4], marginBottom: space[3], opacity: dim ? 0.6 : 1 }}>
        {main}
      </FeatureCard>
    );
  }

  return (
    <Card dim={dim} style={{ marginHorizontal: space[4], marginBottom: space[3] }}>
      {main}

      {/* Action row, beside the card's link rather than inside it. Only a
          pending job has one: everything else is the card's own link. */}
      {!hideActions && status.action === 'acceptReject' && (
        <Animated.View
          pointerEvents={accepting ? 'none' : 'auto'}
          style={[{ flexDirection: 'row', gap: space[3], paddingHorizontal: space[5], paddingBottom: space[4] }, fadeStyle]}
        >
          <Button variant="secondary" full style={{ flex: 1 }} onPress={() => { if (!locked.current) onReject?.(); }}>Reject</Button>
          <Button full style={{ flex: 1 }} onPress={accept}>Accept</Button>
        </Animated.View>
      )}
    </Card>
  );
}
