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
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RouteLine } from '../../components/JobCard';
import { TimelineStop, Stop, pinFor } from '../../components/TimelineStop';
import { ClientCard } from '../../components/ClientCard';
import { SpecialInstructionsCard } from '../../components/SpecialInstructionsCard';
import { SurchargesCard } from '../../components/SurchargesCard';
import { PayCard } from '../../components/JobAmountCard';
import { useTokens } from '../../theme/ThemeProvider';
import { fontFor, space, type, TABULAR } from '../../theme/tokens';
import { useJobDetailByNumber } from '../../lib/queries/jobDetail';
import { formatClock } from '../../lib/timeFormat';
import { routeStops, stopCountLabel } from '../../lib/route';
import { useCompleteJob } from '../../lib/mutations/jobActions';

// S4 — Active Job. Same shape as Job Detail, with the trip in one dark card at
// the top and the Mark as done button below. There is no progress bar and no
// "current stop": the app does not track which stop the driver is at, so the
// old "Stop 1 of N" bar never moved (redesign change 13).
export default function ActiveJob() {
  const T = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, isLoading, isError, error, refetch } = useJobDetailByNumber(id);
  const completeJob = useCompleteJob();
  // Mark as done asks first. Nothing is sent until the driver confirms.
  const [askingDone, setAskingDone] = useState(false);

  if (isLoading || !job) {
    return (
      <AppFrame>
        <AppHeader title={String(id ?? '—')} onBack={() => router.back()}/>
        {isError ? (
          <ErrorBox message={(error as Error)?.message ?? 'Unknown error'} onRetry={() => refetch()}/>
        ) : job === null ? (
          <NotFound/>
        ) : (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={T.text2}/>
          </View>
        )}
      </AppFrame>
    );
  }

  const stopsForUi: Stop[] = routeStops(job.stops).map(r => ({
    kind: r.label, arrive: r.time, place: r.place, lat: r.lat, lng: r.lng,
  }));

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
            what it is doing now. */}
        <FeatureCard style={{ padding: space[5], gap: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
            <Text style={[type.figure, TABULAR, { color: T.onFeature, flexShrink: 1 }]}>
              {firstStop.arrive ?? formatClock(job.pickupAt)}
              {stopsForUi.length > 1 && !!lastStop.arrive && (
                <Text style={[type.heading, { fontFamily: fontFor('600'), fontWeight: '600', color: T.onFeature2 }]}>
                  {' '}to {lastStop.arrive}
                </Text>
              )}
            </Text>
            <StatusPill kind={job.status}/>
          </View>
          <RouteLine from={firstStop.place} to={lastStop.place} onFeature/>
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
            <Text style={[type.label, { color: T.text2 }]}>{stopCountLabel(stopsForUi.length)}</Text>
          </View>
          <View>
            {stopsForUi.map((s, i) => (
              <TimelineStop key={i} stop={s} isLast={i === stopsForUi.length - 1} pin={pinFor(i, stopsForUi.length)}/>
            ))}
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
          <Button full size="lg" icon="check" onPress={() => setAskingDone(true)}>
            {completeJob.isPending ? 'Marking…' : 'Mark as done'}
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
              Report an issue
            </Text>
          </Pressable>
        </View>
      </View>
      <ConfirmDialog
        visible={askingDone}
        title={`Mark ${job.jobNumber} done?`}
        body="Do this once the last passenger is dropped off. Dispatch is told at once."
        cancelLabel="Keep job open"
        confirmLabel="Mark done"
        onCancel={() => setAskingDone(false)}
        onConfirm={() => { setAskingDone(false); onMarkDone(); }}
      />
    </AppFrame>
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

// The job is no longer this driver's: cancelled, reassigned or hidden. Not a
// failure, so there is no Retry. Words are the design mock's.
function NotFound() {
  const T = useTokens();
  return (
    <Card style={{ marginHorizontal: space[4], padding: space[5], gap: space[3] }}>
      <Text style={[type.heading, { color: T.text }]}>This job is no longer on your list</Text>
      <Text style={[type.body, { color: T.text2 }]}>Dispatch may have cancelled or reassigned it.</Text>
      <View style={{ marginTop: space[2], alignSelf: 'flex-start' }}>
        <Button variant="secondary" onPress={() => router.replace('/(tabs)')}>Back to jobs</Button>
      </View>
    </Card>
  );
}
