import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, RefreshControl, ScrollView, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { JobCard, type Job } from '../../components/JobCard';
import { Band } from '../../components/Band';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { useTokens } from '../../theme/ThemeProvider';
import { fontFor, space, type } from '../../theme/tokens';
import { formatDayLong } from '../../lib/timeFormat';
import { useTodaysJobs } from '../../lib/queries/jobs';
import { useConfirmAssignment, useRejectAssignment } from '../../lib/mutations/jobActions';
import { useUnreadCount } from '../../lib/queries/notifications';
import { useDriverProfile } from '../../lib/queries/driverProfile';
import { useJobsRealtime } from '../../lib/realtime/jobsRealtime';
import { useAppVersionGate } from '../../lib/queries/appVersionConfig';

const APP_DOWNLOAD_URL = 'https://app.fleetms.my/driver-app';

// Time-of-day greeting that matches the device's local hour. Saturated to the
// 3 standard buckets so we don't say "Good afternoon" at 1pm and "Good evening"
// at 5pm — drivers travel a lot and the language stays steady.
//
// DELIBERATELY device-local, and the only such reading left in the app. Every
// other clock and date is pinned to Malaysia (lib/timeFormat.ts) because it
// describes a JOB, which happens on MY time. A greeting describes the DRIVER,
// so it should follow the phone they're holding: someone up at 8am elsewhere
// wants "Good morning", not Malaysia's afternoon. Don't "fix" this to match.
function timeOfDayGreeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function JobsToday() {
  const T = useTokens();
  useJobsRealtime();
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

  const overdue = data?.overdue ?? [];
  const today = data?.today ?? [];
  const tomorrow = data?.tomorrow ?? [];
  const upcoming = data?.upcoming ?? [];
  const upcomingTotal = upcoming.reduce((sum, g) => sum + g.jobs.length, 0);

  // MY day, matching the MY day boundaries the Today/Tomorrow groups below use
  // (lib/queries/jobs.ts). Device-local would let this header disagree with
  // which jobs are sitting under 'Today'.
  const headerSubtitle = formatDayLong();

  // Mock RM total — replace with real earnings query once it exists.
  const sumRM = today.length * 80;

  // The group heading's count, on the right of the title.
  const count = { ...type.label, fontFamily: fontFor('600'), fontWeight: '600', color: T.text2 } as const;

  // One job card. An in-progress job opens the trip screen (Upcoming has
  // always opened the job screen, so it passes `tripFromHere: false`).
  const card = (j: Job, opts: { dim?: boolean; overdue?: boolean; tripFromHere?: boolean } = {}) => {
    const open = opts.tripFromHere === false || j.status !== 'progress'
      ? `/jobs/${j.id}`
      : { pathname: '/jobs/active' as const, params: { id: j.id } };
    return (
      <JobCard
        key={j.id}
        job={j}
        dim={opts.dim}
        overdue={opts.overdue}
        onPress={() => router.push(open as Parameters<typeof router.push>[0])}
        onView={() => router.push(`/jobs/${j.id}`)}
        onAccept={async () => {
          if (!j.assignmentId) return;
          try { await confirmAsg.mutateAsync(j.assignmentId); }
          catch (e: any) { Alert.alert('Could not accept', e?.message ?? 'Unknown error'); }
        }}
        onReject={async () => {
          if (!j.assignmentId) return;
          try { await rejectAsg.mutateAsync({ assignmentId: j.assignmentId }); }
          catch (e: any) { Alert.alert('Could not reject', e?.message ?? 'Unknown error'); }
        }}
      />
    );
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
          title={`${timeOfDayGreeting()}, ${firstName}`}
          subtitle={headerSubtitle}
          right={<BellButton/>}
        />

        {versionGate.status === 'recommended' && !bannerDismissed && (
          <UpdateAvailableBanner onDismiss={() => setBannerDismissed(true)}/>
        )}

        {isLoading && <LoadingState/>}
        {isError && <ErrorState message={(error as Error)?.message ?? 'Unknown error'} onRetry={() => refetch()}/>}

        {!isLoading && !isError && overdue.length === 0 && today.length === 0 && tomorrow.length === 0 && <EmptyState/>}

        {!isLoading && !isError && overdue.length > 0 && (
          <>
            <SectionLabel
              right={<Text style={[count, { color: T.redText }]}>
                {overdue.length} {overdue.length === 1 ? 'job' : 'jobs'}
              </Text>}
            >Overdue</SectionLabel>
            <Text style={[type.label, {
              paddingHorizontal: space[5], marginTop: -6, marginBottom: 10, color: T.text2,
            }]}>
              Pickup already passed on a previous day — not for today. Accept, reject, or mark done to clear it.
            </Text>
            {overdue.map(j => card(j, { overdue: true }))}
          </>
        )}

        {!isLoading && !isError && today.length > 0 && (
          <>
            <SectionLabel
              right={<Text style={count}>
                {today.length} {today.length === 1 ? 'job' : 'jobs'} · RM {sumRM}
              </Text>}
            >Today</SectionLabel>
            {today.map(j => card(j, { dim: j.status === 'done' || j.status === 'voided' }))}
          </>
        )}

        {!isLoading && !isError && tomorrow.length > 0 && (
          <>
            <View style={{ height: space[2] }}/>
            <SectionLabel
              right={<Text style={count}>
                {tomorrow.length} {tomorrow.length === 1 ? 'job' : 'jobs'}
              </Text>}
            >Tomorrow</SectionLabel>
            {tomorrow.map(j => card(j, { dim: true }))}
          </>
        )}

        {!isLoading && !isError && upcoming.length > 0 && (
          <>
            <View style={{ height: space[2] }}/>
            <SectionLabel
              right={<Text style={count}>
                {upcomingTotal} {upcomingTotal === 1 ? 'job' : 'jobs'}
              </Text>}
            >Upcoming</SectionLabel>
            {upcoming.map(group => (
              <React.Fragment key={group.dateKey}>
                <View style={{ paddingHorizontal: space[5], paddingTop: 6, paddingBottom: space[2] }}>
                  <Text style={[type.label, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text2 }]}>
                    {group.label}
                  </Text>
                </View>
                {group.jobs.map(j => card(j, { dim: true, tripFromHere: false }))}
              </React.Fragment>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
