import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader } from '../../components/AppHeader';
import { StatusPill } from '../../components/StatusPill';
import { Band } from '../../components/Band';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FeatureCard } from '../../components/FeatureCard';
import { GoFill } from '../../components/GoFill';
import { RouteLine } from '../../components/JobCard';
import { TimelineStop, Stop, pinFor } from '../../components/TimelineStop';
import { ClientCard } from '../../components/ClientCard';
import { SpecialInstructionsCard } from '../../components/SpecialInstructionsCard';
import { SurchargesCard } from '../../components/SurchargesCard';
import { PayCard } from '../../components/JobAmountCard';
import { Icon } from '../../components/Icon';
import { useTokens } from '../../theme/ThemeProvider';
import { fontFor, space, type, TABULAR } from '../../theme/tokens';
import { useJobDetailByNumber } from '../../lib/queries/jobDetail';
import { formatClock } from '../../lib/timeFormat';
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
            <ActivityIndicator color={T.text2}/>
          </View>
        )}
      </AppFrame>
    );
  }

  // Same stop derivation as Job Detail. Could be DRYed once both screens settle.
  const stopsForUi: Stop[] = job.stops.map(s => ({
    kind: s.kind,
    arriveLabel: s.scheduledAt ? 'Arrive' : '—',
    arrive: s.scheduledAt ? formatClock(s.scheduledAt) : '—',
    place: s.location + (s.detail ? `, ${s.detail}` : ''),
    depart: undefined,
    lat: s.lat,
    lng: s.lng,
  }));
  if (stopsForUi.length === 0) {
    stopsForUi.push(
      {
        kind: 'Pickup',
        arriveLabel: 'Pickup',
        arrive: formatClock(job.pickupAt),
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
  const firstStop = stopsForUi[0];
  const lastStop = stopsForUi[stopsForUi.length - 1];

  const onMarkDone = async () => {
    try {
      await completeJob.mutateAsync(job.jobUuid);
      // Defer one frame to avoid the Fabric "child already has parent" race
      // that bites when navigation fires on the same frame as the mutation's
      // RN tree updates. Same workaround the sign-in + set-PIN flows use;
      // surfaced again as the Mark-as-Done crash captured in Sentry as
      // FLEETMS-DRIVER-1 (IllegalStateException at SurfaceMountingManager.addViewAt).
      setTimeout(() => router.replace('/(tabs)'), 0);
    } catch (e: any) {
      Alert.alert('Could not mark done', e?.message ?? 'Unknown error');
    }
  };

  return (
    <AppFrame bottomInset={120}>
      <AppHeader
        title={job.jobNumber}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[5], gap: space[4] }}>
        {/* The trip in one dark card: the time window, where it runs and,
            while the job is live, how far along the stops it is. */}
        <FeatureCard style={{ padding: space[5], gap: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
            <Text style={[type.figure, TABULAR, { color: T.onFeature, flexShrink: 1 }]}>
              {firstStop.arrive}
              {stopsForUi.length > 1 && lastStop.arrive !== '—' && (
                <Text style={[type.heading, { fontFamily: fontFor('600'), fontWeight: '600', color: T.onFeature2 }]}>
                  {' '}to {lastStop.arrive}
                </Text>
              )}
            </Text>
            <StatusPill kind={job.status}/>
          </View>
          <RouteLine from={firstStop.place} to={lastStop.place} onFeature/>
          {isInProgress && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[type.caption, { fontFamily: fontFor('600'), fontWeight: '600', color: T.onFeature2 }]}>
                  Stop {currentIdx + 1} of {stopsForUi.length}
                </Text>
                <Text style={[type.caption, { fontFamily: fontFor('600'), fontWeight: '600', color: T.goLime }]}>
                  In progress
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: T.featureTrack, overflow: 'hidden' }}>
                <View style={{ width: `${progressPct}%`, height: '100%' }}>
                  <GoFill radius={3}/>
                </View>
              </View>
            </View>
          )}
        </FeatureCard>

        <ClientCard
          clientName={job.client}
          passengerName={job.passengerName}
          contact={job.contact}
          pax={job.pax}
          vehicleType={job.vehicleType}
          vehicleModel={job.vehicleModel}
          vehiclePlate={job.vehiclePlate}
        />

        {job.specialInstructions && (
          <SpecialInstructionsCard text={job.specialInstructions}/>
        )}

        <Card style={{ padding: space[5], gap: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[3] }}>
            <Text style={[type.title, { color: T.text }]}>Route</Text>
            <Text style={[type.label, { color: T.text2 }]}>{stopsForUi.length} stops</Text>
          </View>
          <View>
            <RouteWithCollapsedDoneStops stops={stopsForUi} states={states}/>
          </View>
        </Card>

        {/* Pay breakdown, same order and components as Job Detail: what the
            job includes, then the fare, then what the driver gets out of it. A
            driver mid-trip is the person most likely to be asked "is the tolls
            money yours or mine?" at the counter, so this screen can't be the
            one place that stays silent about it. Every piece is a shared
            component for the same reason — this screen was the one that stayed
            silent last time, because the markup lived in the other file. */}
        <SurchargesCard items={job.surcharges}/>

        <PayCard amount={job.amount} commission={job.specialCommission}/>
      </ScrollView>

      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: 30,
        backgroundColor: T.ground,
      }}>
        {isInProgress ? (
          <Button full size="lg" icon="check" onPress={onMarkDone}>
            {completeJob.isPending ? 'Marking…' : 'Mark as Done'}
          </Button>
        ) : (
          <Button variant="secondary" full size="lg" onPress={() => router.back()}>
            Job is {job.status}
          </Button>
        )}
        <View style={{ alignItems: 'center', marginTop: space[3] }}>
          <Pressable>
            <Text style={[type.label, {
              fontFamily: fontFor('600'), fontWeight: '600', color: T.text2, textDecorationLine: 'underline',
            }]}>
              Report an Issue
            </Text>
          </Pressable>
        </View>
      </View>
    </AppFrame>
  );
}

// Renders the route timeline with completed stops collapsed into a single
// summary row by default. Tap to expand the group and show each completed
// stop normally; tap again to re-collapse.
type StopState = 'done' | 'current' | 'upcoming';
function RouteWithCollapsedDoneStops({
  stops, states,
}: { stops: Stop[]; states: StopState[] }) {
  const T = useTokens();
  const [expanded, setExpanded] = useState(false);

  const doneCount = states.filter(s => s === 'done').length;
  // No completed stops yet → render the full timeline normally.
  if (doneCount === 0) {
    return (
      <>
        {stops.map((s, i) => (
          <TimelineStop key={i} stop={s} isLast={i === stops.length - 1} state={states[i]} pin={pinFor(i, stops.length)}/>
        ))}
      </>
    );
  }

  // Completed stops are always at the start (states transition done → current → upcoming
  // in order). Find the split index.
  const firstNonDone = states.findIndex(s => s !== 'done');
  const doneStops = stops.slice(0, firstNonDone === -1 ? stops.length : firstNonDone);
  const restStops = stops.slice(firstNonDone === -1 ? stops.length : firstNonDone);
  const restStates = states.slice(firstNonDone === -1 ? stops.length : firstNonDone);

  // Build the summary text: time range + place chain abbreviated.
  const firstDone = doneStops[0];
  const lastDone = doneStops[doneStops.length - 1];
  const timeRange = `${firstDone.arrive} to ${lastDone.arrive}`;
  const placeChain = doneStops.map(s => s.place.split(',')[0]).join(' · ');

  return (
    <>
      {expanded ? (
        <>
          {doneStops.map((s, i) => (
            <TimelineStop key={`done-${i}`} stop={s} isLast={false} state="done" pin={pinFor(i, stops.length)}/>
          ))}
          <Pressable
            onPress={() => setExpanded(false)}
            style={({ pressed }) => ({
              paddingVertical: space[2], marginBottom: 6,
              flexDirection: 'row', alignItems: 'center', gap: 6,
              opacity: pressed ? 0.5 : 1,
            })}
            hitSlop={8}
          >
            <Icon name="chevUp" size={14} stroke={2.4} color={T.text2}/>
            <Text style={[type.label, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text2 }]}>
              Hide completed
            </Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={() => setExpanded(true)}
          style={({ pressed }) => ({
            paddingVertical: space[3], paddingHorizontal: space[3], borderRadius: 12,
            backgroundColor: T.surfaceSunk, marginBottom: space[3],
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name="checkCirc" size={18} color={T.goText}/>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] }}>
              <Text style={[type.label, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text }]}>
                {doneCount} {doneCount === 1 ? 'stop' : 'stops'} completed
              </Text>
              <Text style={[type.caption, TABULAR, { color: T.text2 }]} numberOfLines={1}>
                {timeRange}
              </Text>
            </View>
            <Text style={[type.caption, { color: T.text2, marginTop: 2 }]} numberOfLines={1}>
              {placeChain}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={[type.caption, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text2 }]}>Show</Text>
            <Icon name="chevDown" size={14} stroke={2.4} color={T.text2}/>
          </View>
        </Pressable>
      )}

      {restStops.map((s, i) => (
        <TimelineStop
          key={`rest-${i}`} stop={s} isLast={i === restStops.length - 1} state={restStates[i]}
          pin={pinFor(doneStops.length + i, stops.length)}
        />
      ))}
    </>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  const T = useTokens();
  return (
    <Band tone="red" style={{ marginHorizontal: space[4] }}>
      <Text style={[type.body, { fontFamily: fontFor('600'), fontWeight: '600', color: T.redText }]}>Couldn't load active job</Text>
      <Text style={[type.body, { color: T.redText, marginTop: 4 }]}>{message}</Text>
      <View style={{ marginTop: space[3], alignSelf: 'flex-start' }}>
        <Button variant="secondary" onPress={onRetry}>Retry</Button>
      </View>
    </Band>
  );
}
