import React, { useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader } from '../../components/AppHeader';
import { StatusPill } from '../../components/StatusPill';
import { jobStatus } from '../../lib/jobStatus';
import { Button } from '../../components/Button';
import { FeatureCard } from '../../components/FeatureCard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RouteLine } from '../../components/JobCard';
import { RouteCard } from '../../components/RouteCard';
import { RecordState, JOB_NOT_FOUND } from '../../components/RecordState';
import { ClientCard } from '../../components/ClientCard';
import { SpecialInstructionsCard } from '../../components/SpecialInstructionsCard';
import { SurchargesCard } from '../../components/SurchargesCard';
import { PayCard } from '../../components/JobAmountCard';
import { useTokens } from '../../theme/ThemeProvider';
import { fontFor, space, type, TABULAR } from '../../theme/tokens';
import { useJobDetailByNumber } from '../../lib/queries/jobDetail';
import { formatClock } from '../../lib/timeFormat';
import { useClockStyle } from '../../lib/clockPref';
import { routeStops } from '../../lib/route';
import { useCompleteJob } from '../../lib/mutations/jobActions';

// S4 — Active Job. Same shape as Job Detail, with the trip in one dark card at
// the top and the Mark as done button below. There is no progress bar and no
// "current stop": the app does not track which stop the driver is at, so the
// old "Stop 1 of N" bar never moved (redesign change 13).
export default function ActiveJob() {
  const T = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, isError, error, refetch } = useJobDetailByNumber(id);
  const clock = useClockStyle();
  const completeJob = useCompleteJob();
  // Mark as done asks first. Nothing is sent until the driver confirms.
  const [askingDone, setAskingDone] = useState(false);

  if (!job) {
    return (
      <RecordState
        title={String(id ?? '—')}
        errorTitle="Couldn't load job"
        notFound={JOB_NOT_FOUND}
        query={{ data: job, isError, error, refetch }}
      />
    );
  }

  const route = routeStops(job.stops, clock);

  // Only an In progress job can be marked done; any other status gets "Back to jobs".
  const isInProgress = jobStatus(job.status).action === 'openTrip';
  const firstStop = route[0];
  const lastStop = route[route.length - 1];

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
              {firstStop.time ?? formatClock(job.pickupAt, clock)}
              {route.length > 1 && !!lastStop.time && (
                <Text style={[type.heading, { fontFamily: fontFor('600'), fontWeight: '600', color: T.onFeature2 }]}>
                  {' '}to {lastStop.time}
                </Text>
              )}
            </Text>
            <StatusPill kind="job" status={job.status}/>
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

        <RouteCard stops={job.stops} clock={clock}/>

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
            Back to jobs
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
