import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, RefreshControl, ScrollView, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { JobCard } from '../../components/JobCard';
import { Icon } from '../../components/Icon';
import { useTokens } from '../../theme/ThemeProvider';
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

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: T.page }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={T.muted}
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
              right={<Text style={{ fontSize: 12, color: T.red, fontWeight: '700' }}>
                {overdue.length} {overdue.length === 1 ? 'job' : 'jobs'}
              </Text>}
            >Overdue</SectionLabel>
            <Text style={{
              paddingHorizontal: 20, marginTop: -6, marginBottom: 10,
              fontSize: 12.5, color: T.muted, lineHeight: 17,
            }}>
              Pickup already passed on a previous day — not for today. Accept, reject, or mark done to clear it.
            </Text>
            {overdue.map(j => (
              <JobCard
                key={j.id}
                job={j}
                overdue
                onPress={() => router.push(
                  j.status === 'progress'
                    ? { pathname: '/jobs/active', params: { id: j.id } }
                    : `/jobs/${j.id}`,
                )}
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
            ))}
          </>
        )}

        {!isLoading && !isError && today.length > 0 && (
          <>
            <SectionLabel
              right={<Text style={{ fontSize: 12, color: T.muted, fontWeight: '600' }}>
                {today.length} {today.length === 1 ? 'job' : 'jobs'} · RM {sumRM}
              </Text>}
            >Today</SectionLabel>
            {today.map(j => (
              <JobCard
                key={j.id}
                job={j}
                dim={j.status === 'done' || j.status === 'voided'}
                onPress={() => router.push(
                  j.status === 'progress'
                    ? { pathname: '/jobs/active', params: { id: j.id } }
                    : `/jobs/${j.id}`,
                )}
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
            ))}
          </>
        )}

        {!isLoading && !isError && tomorrow.length > 0 && (
          <>
            <View style={{ height: 8 }}/>
            <SectionLabel
              right={<Text style={{ fontSize: 12, color: T.muted, fontWeight: '600' }}>
                {tomorrow.length} {tomorrow.length === 1 ? 'job' : 'jobs'}
              </Text>}
            >Tomorrow</SectionLabel>
            {tomorrow.map(j => (
              <JobCard
                key={j.id}
                job={j}
                dim
                onPress={() => router.push(
                  j.status === 'progress'
                    ? { pathname: '/jobs/active', params: { id: j.id } }
                    : `/jobs/${j.id}`,
                )}
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
            ))}
          </>
        )}

        {!isLoading && !isError && upcoming.length > 0 && (
          <>
            <View style={{ height: 8 }}/>
            <SectionLabel
              right={<Text style={{ fontSize: 12, color: T.muted, fontWeight: '600' }}>
                {upcomingTotal} {upcomingTotal === 1 ? 'job' : 'jobs'}
              </Text>}
            >Upcoming</SectionLabel>
            {upcoming.map(group => (
              <React.Fragment key={group.dateKey}>
                <View style={{
                  paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8,
                }}>
                  <Text style={{
                    fontSize: 11, fontWeight: '700', color: T.mutedLight,
                    letterSpacing: 0.4, textTransform: 'uppercase',
                  }}>{group.label}</Text>
                </View>
                {group.jobs.map(j => (
                  <JobCard
                    key={j.id}
                    job={j}
                    dim
                    onPress={() => router.push(`/jobs/${j.id}`)}
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
                ))}
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
    <View style={{
      marginHorizontal: 16, marginBottom: 14,
      backgroundColor: T.amberSoft, borderRadius: 10,
      paddingVertical: 10, paddingHorizontal: 14,
      flexDirection: 'row', alignItems: 'center', gap: 10,
    }}>
      <Text style={{ flex: 1, fontSize: 13, color: T.amberFg, lineHeight: 18 }}>
        A newer version of FleetMS Driver is available.{' '}
        <Text
          style={{ fontWeight: '700', textDecorationLine: 'underline' }}
          onPress={() => { Linking.openURL(APP_DOWNLOAD_URL); }}
        >
          Update
        </Text>
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8} style={{ padding: 2 }}>
        <Icon name="x" size={16} color={T.amberFg}/>
      </Pressable>
    </View>
  );
}

function BellButton() {
  const T = useTokens();
  const unread = useUnreadCount();
  return (
    <Pressable
      onPress={() => router.push('/notifications' as '/')}
      // Icon-only — no fill, no border. The previous chrome (T.surface bg +
      // T.border) sat awkwardly on top of T.page in light mode where surface
      // and page are close-but-not-equal off-whites. Cleaner without it.
      style={({ pressed }) => ({
        width: 42, height: 42, borderRadius: 21,
        alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
      hitSlop={8}
    >
      <Icon name="bell" size={20} color={T.text}/>
      {unread > 0 && (
        <View style={{
          position: 'absolute', top: 8, right: 9,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: T.red, borderWidth: 2, borderColor: T.page,
        }}/>
      )}
    </Pressable>
  );
}

function LoadingState() {
  const T = useTokens();
  return (
    <View style={{ paddingVertical: 60, alignItems: 'center' }}>
      <ActivityIndicator color={T.muted}/>
      <Text style={{ marginTop: 12, fontSize: 13, color: T.muted }}>Loading today's jobs…</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const T = useTokens();
  const sessionInfo = (globalThis as any).__FLEETMS_DEV_SESSION__;
  return (
    <View style={{
      marginHorizontal: 16, padding: 16, borderRadius: 12,
      backgroundColor: T.redSoft, borderWidth: 1, borderColor: T.red,
    }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: T.redFg, marginBottom: 4 }}>
        Couldn't load jobs
      </Text>
      <Text style={{ fontSize: 13, color: T.redFg, lineHeight: 19 }}>{message}</Text>
      {sessionInfo && sessionInfo.kind !== 'ok' && (
        <Text style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
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
      <Pressable
        onPress={onRetry}
        style={{ marginTop: 12, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: T.red }}
      >
        <Text style={{ fontSize: 13, color: T.redFg, fontWeight: '600' }}>Retry</Text>
      </Pressable>
    </View>
  );
}

function EmptyState() {
  const T = useTokens();
  return (
    <View style={{ paddingHorizontal: 28, paddingVertical: 40, alignItems: 'center' }}>
      <View style={{
        width: 140, height: 140, borderRadius: 70,
        backgroundColor: T.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: T.borderHard,
        alignItems: 'center', justifyContent: 'center', marginBottom: 18,
      }}>
        <Icon name="calendar" size={56} stroke={1.5} color={T.mutedLight}/>
      </View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: T.text, marginBottom: 6 }}>
        No jobs scheduled today
      </Text>
      <Text style={{ fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 21, maxWidth: 280 }}>
        You're all clear. New jobs will appear here when dispatch assigns them.
      </Text>
    </View>
  );
}
