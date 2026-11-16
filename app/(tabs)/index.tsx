import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, RefreshControl, ScrollView, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { JobCard, type Job } from '../../components/JobCard';
import { Band } from '../../components/Band';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { useTokens } from '../../theme/ThemeProvider';
import { EASE_OUT, fontFor, motionFor, radius, space, type } from '../../theme/tokens';
import { formatDayLong } from '../../lib/timeFormat';
import { useTodaysJobs } from '../../lib/queries/jobs';
import { useConfirmAssignment, useRejectAssignment } from '../../lib/mutations/jobActions';
import { useUnreadCount } from '../../lib/queries/notifications';
import { useDriverProfile } from '../../lib/queries/driverProfile';
import { useAppVersionGate } from '../../lib/queries/appVersionConfig';
import {
  countRose, getFinishedSeen, greeting, groupJobs, jobCount, jobScreen, setFinishedSeen, todayHeading,
} from '../../lib/jobGroups';

const APP_DOWNLOAD_URL = 'https://app.fleetms.my/driver-app';

const CURVE = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

export default function JobsToday() {
  const T = useTokens();
  const { data, isLoading, isError, error, refetch, isRefetching } = useTodaysJobs();
  const { data: profile } = useDriverProfile();
  const confirmAsg = useConfirmAssignment();
  const rejectAsg = useRejectAssignment();
  const firstName = profile?.name.split(/\s+/)[0] ?? 'driver';
  const versionGate = useAppVersionGate();
  // Local-only dismiss state — resets on every cold start by design (no
  // AsyncStorage). The Profile tab badge is the persistent signal; this
  // banner is just a soft nudge.
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // The job the driver tapped Reject on. Nothing is sent until the dialog is confirmed.
  const [rejecting, setRejecting] = useState<Job | null>(null);

  const groups = groupJobs({
    overdue: data?.overdue ?? [],
    today: data?.today ?? [],
    tomorrow: data?.tomorrow ?? [],
    upcoming: data?.upcoming ?? [],
  });
  const { overdue, today, todayFinished, tomorrow, upcoming } = groups;
  const upcomingTotal = upcoming.reduce((sum, g) => sum + g.jobs.length, 0);

  // MY day, matching the MY day boundaries the Today/Tomorrow groups below use
  // (lib/queries/jobs.ts). Device-local would let this header disagree with
  // which jobs are sitting under 'Today'.
  const headerSubtitle = formatDayLong();

  // The group heading's count, on the right of the title.
  const count = { ...type.label, fontFamily: fontFor('600'), fontWeight: '600', color: T.text2 } as const;

  // One job card. An in-progress job opens the trip screen from every group;
  // anything else opens the job screen.
  const card = (j: Job, opts: { dim?: boolean; overdue?: boolean } = {}) => {
    const open = jobScreen(j) === 'trip'
      ? { pathname: '/jobs/active' as const, params: { id: j.id } }
      : `/jobs/${j.id}`;
    return (
      <JobCard
        key={j.id}
        job={j}
        dim={opts.dim}
        overdue={opts.overdue}
        onPress={() => router.push(open as Parameters<typeof router.push>[0])}
        onAccept={async () => {
          if (!j.assignmentId) return false;
          try { await confirmAsg.mutateAsync(j.assignmentId); return true; }
          catch (e: any) { Alert.alert('Could not accept', e?.message ?? 'Unknown error'); return false; }
        }}
        onReject={() => setRejecting(j)}
      />
    );
  };

  const confirmReject = async (reason?: string) => {
    const j = rejecting;
    setRejecting(null);
    if (!j?.assignmentId) return;
    try { await rejectAsg.mutateAsync({ assignmentId: j.assignmentId, reason: reason || undefined }); }
    catch (e: any) { Alert.alert('Could not reject', e?.message ?? 'Unknown error'); }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: T.ground }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space[6] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={T.text2}
          />
        }
      >
        <AppHeader
          title={`${greeting(new Date().getHours())}, ${firstName}`}
          subtitle={headerSubtitle}
          right={<BellButton/>}
        />

        {versionGate.status === 'recommended' && !bannerDismissed && (
          <UpdateAvailableBanner onDismiss={() => setBannerDismissed(true)}/>
        )}

        {isLoading && <LoadingState/>}
        {isError && <ErrorState message={(error as Error)?.message ?? 'Unknown error'} onRetry={() => refetch()}/>}

        {!isLoading && !isError && groups.empty && <EmptyState/>}

        {!isLoading && !isError && overdue.length > 0 && (
          <>
            <SectionLabel
              right={<Text style={[count, { color: T.redText }]}>{jobCount(overdue.length)}</Text>}
            >Overdue</SectionLabel>
            <Text style={[type.label, {
              paddingHorizontal: space[5], marginTop: -6, marginBottom: 10, color: T.text2,
            }]}>
              Pickup already passed on a previous day — not for today. Accept, reject, or mark done to clear it.
            </Text>
            {overdue.map(j => card(j, { overdue: true }))}
          </>
        )}

        {!isLoading && !isError && (today.length > 0 || todayFinished.length > 0) && (
          <>
            <SectionLabel
              right={<Text style={count}>{todayHeading(today.length)}</Text>}
            >Today</SectionLabel>
            {today.map(j => card(j))}
            {todayFinished.length > 0 && (
              <FinishedToday count={todayFinished.length}>
                {todayFinished.map(j => card(j, { dim: true }))}
              </FinishedToday>
            )}
          </>
        )}

        {!isLoading && !isError && tomorrow.length > 0 && (
          <>
            <View style={{ height: space[2] }}/>
            <SectionLabel
              right={<Text style={count}>{jobCount(tomorrow.length)}</Text>}
            >Tomorrow</SectionLabel>
            {tomorrow.map(j => card(j, { dim: true }))}
          </>
        )}

        {!isLoading && !isError && upcoming.length > 0 && (
          <>
            <View style={{ height: space[2] }}/>
            <SectionLabel
              right={<Text style={count}>{jobCount(upcomingTotal)}</Text>}
            >Upcoming</SectionLabel>
            {upcoming.map(group => (
              <React.Fragment key={group.dateKey}>
                <View style={{ paddingHorizontal: space[5], paddingTop: 6, paddingBottom: space[2] }}>
                  <Text style={[type.label, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text2 }]}>
                    {group.label}
                  </Text>
                </View>
                {group.jobs.map(j => card(j, { dim: true }))}
              </React.Fragment>
            ))}
          </>
        )}
      </ScrollView>

      {/* Reject asks first, with an optional reason dispatch will see. */}
      <ConfirmDialog
        visible={!!rejecting}
        title={`Reject ${rejecting?.id ?? ''}?`}
        body="Dispatch will give it to another driver."
        reason={{ label: 'Reason (optional)', placeholder: 'Dispatch will see this.', optional: true }}
        confirmLabel="Reject job"
        cancelLabel="Keep job"
        tone="danger"
        onConfirm={confirmReject}
        onCancel={() => setRejecting(null)}
      />
    </SafeAreaView>
  );
}

/**
 * Today's done and cancelled jobs, closed by default so the job under way and
 * the next pickups lead the list. One tap opens them. The panel opens at once
 * and its jobs fade in (opacity only, never height); closing fades them out
 * first. Reduce Motion keeps the fades.
 */
function FinishedToday({ count, children }: { count: number; children: React.ReactNode }) {
  const T = useTokens();
  const reduced = useReducedMotion();
  const m = motionFor(reduced);
  const [open, setOpen] = useState(false);
  // Closing fades the jobs out first, then the panel shuts. Tapping again mid-fade reopens at once.
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const panel = useSharedValue(0);
  const panelStyle = useAnimatedStyle(() => ({ opacity: panel.value }));
  const toggle = () => {
    clearTimeout(timer.current);
    if (open && !closing) {
      setClosing(true);
      panel.value = withTiming(0, { duration: m.fade1, easing: CURVE });
      timer.current = setTimeout(() => { setOpen(false); setClosing(false); }, m.fade1);
    } else {
      setClosing(false);
      setOpen(true);
      panel.value = withTiming(1, { duration: m.fade2, easing: CURVE });
    }
  };
  const shown = open && !closing;

  // The count bumps once when it grew since the driver last saw it, so they see
  // where a finished job went. The last-seen count lives outside the screen
  // (lib/jobGroups.ts) because a job is usually marked done on the trip screen,
  // and this fold is drawn fresh when the driver comes back.
  const scale = useSharedValue(1);
  const countStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const lastSeen = useRef(getFinishedSeen());
  useEffect(() => {
    if (countRose(lastSeen.current, count) && !reduced) {
      scale.value = withSequence(
        withTiming(1.15, { duration: m.fade1 * 0.8, easing: CURVE }),
        withTiming(1, { duration: m.fade2 * 0.6, easing: CURVE }),
      );
    }
    lastSeen.current = count;
    setFinishedSeen(count);
  }, [count, reduced, scale, m.fade1, m.fade2]);

  return (
    <View style={{
      marginHorizontal: space[4], marginBottom: space[3], borderRadius: radius.xl,
      backgroundColor: T.surfaceSunk, borderWidth: 1, borderColor: T.hairlineStrong,
    }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Finished today"
        accessibilityState={{ expanded: shown }}
        onPress={toggle}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 48, paddingHorizontal: space[4] }}
      >
        <Text style={[type.label, { flex: 1, fontFamily: fontFor('600'), fontWeight: '600', color: T.text2 }]}>
          Finished today
        </Text>
        <Animated.View style={countStyle}>
          <Text style={[type.label, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text2 }]}>{jobCount(count)}</Text>
        </Animated.View>
        <Icon name={shown ? 'chevUp' : 'chevDown'} size={18} stroke={2.4} color={T.text2}/>
      </Pressable>
      {open && (
        // The cards carry their own side margin; pull the panel in to match the fold's padding.
        <Animated.View style={[{ marginHorizontal: -(space[4] - space[2]), paddingBottom: space[1] }, panelStyle]}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

function UpdateAvailableBanner({ onDismiss }: { onDismiss: () => void }) {
  const T = useTokens();
  return (
    <Band
      tone="amber"
      icon="info"
      style={{ marginHorizontal: space[4], marginBottom: space[4] }}
      action={
        <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8} style={{ padding: 2 }}>
          <Icon name="x" size={16} stroke={2.4} color={T.amberText}/>
        </Pressable>
      }
    >
      <Text style={[type.body, { color: T.amberText }]}>
        A newer version of FleetMS Driver is available.{' '}
        <Text
          style={{ fontFamily: fontFor('600'), fontWeight: '600', textDecorationLine: 'underline' }}
          onPress={() => { Linking.openURL(APP_DOWNLOAD_URL); }}
        >
          Update
        </Text>
      </Text>
    </Band>
  );
}

function BellButton() {
  const T = useTokens();
  const unread = useUnreadCount();
  return (
    <Pressable
      onPress={() => router.push('/notifications' as '/')}
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      // The admin's sunk icon button: a quiet round well, no shadow.
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: T.surfaceSunk,
        alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
      hitSlop={8}
    >
      <Icon name="bell" size={20} stroke={2.2} color={T.text}/>
      {unread > 0 && (
        <View style={{
          position: 'absolute', top: 9, right: 10,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: T.danger, borderWidth: 2, borderColor: T.surfaceSunk,
        }}/>
      )}
    </Pressable>
  );
}

function LoadingState() {
  const T = useTokens();
  return (
    <View style={{ paddingVertical: 60, alignItems: 'center' }}>
      <ActivityIndicator color={T.text2}/>
      <Text style={[type.label, { marginTop: space[3], color: T.text2 }]}>Loading today's jobs…</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const T = useTokens();
  const sessionInfo = (globalThis as any).__FLEETMS_DEV_SESSION__;
  return (
    <Band tone="red" style={{ marginHorizontal: space[4] }}>
      <Text style={[type.body, { fontFamily: fontFor('600'), fontWeight: '600', color: T.redText, marginBottom: 4 }]}>
        Couldn't load jobs
      </Text>
      <Text style={[type.body, { color: T.redText }]}>{message}</Text>
      {sessionInfo && sessionInfo.kind !== 'ok' && (
        <Text style={[type.caption, { color: T.text2, marginTop: space[2] }]}>
          Auth status: {sessionInfo.kind}
          {sessionInfo.kind === 'error' ? ` — ${sessionInfo.message}` : ''}
          {sessionInfo.kind === 'no-config'
            ? '. Set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.'
            : ''}
          {sessionInfo.kind === 'no-creds'
            ? '. Set EXPO_PUBLIC_DEV_DRIVER_EMAIL + EXPO_PUBLIC_DEV_DRIVER_PASSWORD in .env.'
            : ''}
        </Text>
      )}
      <View style={{ marginTop: space[3], alignSelf: 'flex-start' }}>
        <Button variant="secondary" onPress={onRetry}>Retry</Button>
      </View>
    </Band>
  );
}

function EmptyState() {
  const T = useTokens();
  return (
    <Card style={{
      marginHorizontal: space[4], paddingHorizontal: space[6], paddingVertical: space[8],
      alignItems: 'center', gap: space[2],
    }}>
      <Icon name="calendarDays" size={32} stroke={1.8} color={T.text3}/>
      <Text style={[type.heading, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text, marginTop: space[2], textAlign: 'center' }]}>
        No jobs scheduled today
      </Text>
      <Text style={[type.body, { color: T.text2, textAlign: 'center', maxWidth: 300 }]}>
        You're all clear. New jobs will appear here when dispatch assigns them.
      </Text>
    </Card>
  );
}
