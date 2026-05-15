import React from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { StatusPill } from '../../components/StatusPill';
import { Button } from '../../components/Button';
import { TimelineStop, Stop } from '../../components/TimelineStop';
import { Icon } from '../../components/Icon';
import { useTokens } from '../../theme/ThemeProvider';
import { useJobDetailByNumber } from '../../lib/queries/jobDetail';
import { useCompleteJob } from '../../lib/mutations/jobActions';

// S4 — Active Job. Same shape as Job Detail but UI emphasises progress and
// surfaces the Mark as Done CTA. Currently treats stop 1 as "current"; a real
// implementation would track per-stop progress in job_stops.
export default function ActiveJob() {
  const T = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, isLoading, isError, error, refetch } = useJobDetailByNumber(id);
  const completeJob = useCompleteJob();

  if (isLoading || !job) {
    return (
      <AppFrame>
        <AppHeader title={String(id ?? '—')} onBack={() => router.back()}/>
        {isError ? (
          <ErrorBox message={(error as Error)?.message ?? 'Unknown error'} onRetry={() => refetch()}/>
        ) : (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={T.muted}/>
          </View>
        )}
      </AppFrame>
    );
  }

  // Same stop derivation as Job Detail. Could be DRYed once both screens settle.
  const stopsForUi: Stop[] = job.stops.map(s => ({
    kind: s.kind,
    arriveLabel: s.scheduledAt ? 'Arrive' : '—',
    arrive: s.scheduledAt
      ? new Date(s.scheduledAt).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
      : '—',
    place: s.location + (s.detail ? `, ${s.detail}` : ''),
    depart: undefined,
  }));
  if (stopsForUi.length === 0) {
    stopsForUi.push(
      {
        kind: 'Pickup',
        arriveLabel: 'Pickup',
        arrive: new Date(job.pickupAt).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
        place: job.pickupLocation + (job.pickupDetail ? `, ${job.pickupDetail}` : ''),
        depart: undefined,
      },
      {
        kind: 'Dropoff',
        arriveLabel: 'Arrive',
        arrive: '—',
        place: job.dropoffLocation + (job.dropoffDetail ? `, ${job.dropoffDetail}` : ''),
        depart: undefined,
      },
    );
  }

  // Naive "current = first non-done". Per-stop state machine isn't built yet.
  const currentIdx = 0;
  const states: ('done' | 'current' | 'upcoming')[] = stopsForUi.map((_, i) =>
    i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming',
  );
  const progressPct = stopsForUi.length > 1 ? Math.round(((currentIdx + 0.5) / stopsForUi.length) * 100) : 50;

  const isInProgress = job.rawStatus === 'in_progress';

  const onMarkDone = async () => {
    try {
      await completeJob.mutateAsync(job.jobUuid);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Could not mark done', e?.message ?? 'Unknown error');
    }
  };

  return (
    <AppFrame bottomInset={120}>
      <AppHeader
        title={job.jobNumber}
        onBack={() => router.back()}
        right={<StatusPill kind={job.status} pulse={isInProgress}/>}
      />

      {isInProgress && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6,
          }}>
            <Text style={{ fontSize: 11, color: T.muted, fontWeight: '600', letterSpacing: 0.4 }}>
              STOP {currentIdx + 1} OF {stopsForUi.length}
            </Text>
            <Text style={{ fontSize: 11, color: T.accentFg, fontWeight: '600', letterSpacing: 0.4 }}>
              IN PROGRESS
            </Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: T.border, overflow: 'hidden' }}>
            <View style={{ width: `${progressPct}%`, height: '100%', backgroundColor: T.accent }}/>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <SectionLabel>Route</SectionLabel>
        <View style={{
          backgroundColor: T.surface, borderRadius: 12,
          paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8, marginBottom: 18,
          shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}>
          {stopsForUi.map((s, i) => (
            <TimelineStop key={i} stop={s} isLast={i === stopsForUi.length - 1} state={states[i]}/>
          ))}
        </View>

        {job.amount !== null && (
          <View style={{
            backgroundColor: T.surface, borderRadius: 12,
            paddingHorizontal: 16, paddingVertical: 14,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}>
            <View>
              <Text style={{ fontSize: 12, color: T.muted, fontWeight: '600' }}>Earnings on completion</Text>
              <Text style={{ fontSize: 11, color: T.mutedLight }}>
                {job.client}{job.pax ? ` · ${job.pax} pax` : ''}
              </Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: T.text, letterSpacing: -0.5 }}>
              RM {job.amount.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30,
        backgroundColor: T.page,
      }}>
        {isInProgress ? (
          <Button variant="green" full size="lg" onPress={onMarkDone}>
            <Icon name="check" size={20} stroke={3} color="#fff"/>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>
              {completeJob.isPending ? 'Marking…' : 'Mark as Done'}
            </Text>
          </Button>
        ) : (
          <Button variant="secondary" full size="lg" onPress={() => router.back()}>
            Job is {job.status}
          </Button>
        )}
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <Pressable>
            <Text style={{ fontSize: 13, color: T.red, fontWeight: '600', textDecorationLine: 'underline' }}>
              Report an Issue
            </Text>
          </Pressable>
        </View>
      </View>
    </AppFrame>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  const T = useTokens();
  return (
    <View style={{
      marginHorizontal: 16, padding: 16, borderRadius: 12,
      backgroundColor: T.redSoft, borderWidth: 1, borderColor: T.red,
    }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: T.redFg }}>Couldn't load active job</Text>
      <Text style={{ fontSize: 13, color: T.redFg, lineHeight: 19, marginTop: 4 }}>{message}</Text>
      <Pressable
        onPress={onRetry}
        style={{ marginTop: 12, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: T.red }}
      >
        <Text style={{ fontSize: 13, color: T.redFg, fontWeight: '600' }}>Retry</Text>
      </Pressable>
    </View>
  );
}
