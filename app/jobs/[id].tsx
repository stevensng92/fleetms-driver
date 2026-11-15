import React from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader } from '../../components/AppHeader';
import { StatusPill } from '../../components/StatusPill';
import { Band } from '../../components/Band';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TimelineStop, Stop, pinFor } from '../../components/TimelineStop';
import { ClientCard } from '../../components/ClientCard';
import { SpecialInstructionsCard } from '../../components/SpecialInstructionsCard';
import { SurchargesCard } from '../../components/SurchargesCard';
import { PayCard } from '../../components/JobAmountCard';
import { useTokens } from '../../theme/ThemeProvider';
import { fontFor, space, type } from '../../theme/tokens';
import { formatClock } from '../../lib/timeFormat';
import { useJobDetailByNumber } from '../../lib/queries/jobDetail';
import { useStartJob, useConfirmAssignment, useRejectAssignment } from '../../lib/mutations/jobActions';

// S3 — Job Detail. Reads the real job by job_number; the route param is the
// human-visible JOB-XXX that JobCard shows.
export default function JobDetail() {
  const T = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, isLoading, isError, error, refetch } = useJobDetailByNumber(id);

  const startJob = useStartJob();
  const confirmAsg = useConfirmAssignment();
  const rejectAsg = useRejectAssignment();

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

  const stopsForUi: Stop[] = job.stops.map(s => ({
    kind: s.kind,
    arriveLabel: s.scheduledAt ? 'Arrive' : '—',
    arrive: s.scheduledAt ? formatClock(s.scheduledAt) : '—',
    place: s.location + (s.detail ? `, ${s.detail}` : ''),
    depart: undefined,
    lat: s.lat,
    lng: s.lng,
  }));

  // Fallback to a 2-stop pickup+dropoff if no job_stops rows exist.
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

  const isPending = job.rawStatus === 'pending';
  const isConfirmed = job.rawStatus === 'confirmed';

  return (
    <AppFrame bottomInset={120}>
      <AppHeader
        title={job.jobNumber}
        onBack={() => router.back()}
        right={<StatusPill kind={job.status}/>}
      />

      <View style={{ paddingHorizontal: space[4], paddingBottom: space[5], gap: space[4] }}>
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
            {stopsForUi.map((s, i) => (
              <TimelineStop key={i} stop={s} isLast={i === stopsForUi.length - 1} pin={pinFor(i, stopsForUi.length)}/>
            ))}
          </View>
        </Card>

        <SurchargesCard items={job.surcharges}/>

        {/* The fare and, under it, the job's own pay when it is not the
            driver's normal cut. Non-default pay is rendered independently of
            `amount` because an unpriced job can still carry pay the driver
            should know about before accepting — and under fixed-fee pricing
            that is no longer a hypothetical: a flat fee resolves whatever the
            fare, so a fareless job can have a real, knowable payout. */}
        <PayCard amount={job.amount} commission={job.specialCommission}/>
      </View>

      {/* Sticky CTA — depends on status */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: 30,
        backgroundColor: T.ground,
      }}>
        {isPending && job.assignmentId && (
          <>
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <Button
                variant="secondary" full size="lg" style={{ flex: 1 }}
                onPress={() => promptReject(job.assignmentId!, rejectAsg.mutateAsync, () => router.back())}
              >
                Reject
              </Button>
              <Button
                full size="lg" style={{ flex: 1 }}
                onPress={async () => {
                  try { await confirmAsg.mutateAsync(job.assignmentId!); }
                  catch (e: any) { Alert.alert('Could not confirm', e?.message ?? 'Unknown error'); }
                }}
              >
                {confirmAsg.isPending ? 'Confirming…' : 'Accept'}
              </Button>
            </View>
          </>
        )}

        {isConfirmed && (
          <Button
            full size="lg" trailingIcon="arrowRight"
            onPress={async () => {
              try {
                await startJob.mutateAsync(job.jobUuid);
                router.replace({ pathname: '/jobs/active', params: { id: job.jobNumber } });
              } catch (e: any) {
                Alert.alert('Could not start', e?.message ?? 'Unknown error');
              }
            }}
          >
            {startJob.isPending ? 'Starting…' : 'On My Way'}
          </Button>
        )}

        {job.rawStatus === 'in_progress' && (
          <Button full size="lg" onPress={() => router.replace({ pathname: '/jobs/active', params: { id: job.jobNumber } })}>
            Open Active Job
          </Button>
        )}

        {(job.rawStatus === 'done' || job.rawStatus === 'cancelled' || job.rawStatus === 'rejected') && (
          <Button variant="secondary" full size="lg" onPress={() => router.back()}>
            Back to Jobs
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

// Simple Alert.prompt-style reject flow. Alert.prompt is iOS-only; on Android
// we fall through to a no-reason reject. Replace with a proper sheet later.
function promptReject(
  assignmentId: string,
  mutate: (args: { assignmentId: string; reason?: string }) => Promise<unknown>,
  onDone: () => void,
) {
  const doReject = (reason?: string) => {
    mutate({ assignmentId, reason })
      .then(onDone)
      .catch((e: any) => Alert.alert('Could not reject', e?.message ?? 'Unknown error'));
  };

  if ((Alert as any).prompt) {
    (Alert as any).prompt(
      'Reject this job?',
      'Optional reason — dispatcher will see this.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: (text: string) => doReject(text || undefined) },
      ],
      'plain-text',
      '',
    );
  } else {
    Alert.alert(
      'Reject this job?',
      'Are you sure? Dispatcher will need to reassign.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => doReject() },
      ],
    );
  }
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  const T = useTokens();
  return (
    <Band tone="red" style={{ marginHorizontal: space[4] }}>
      <Text style={[type.body, { fontFamily: fontFor('600'), fontWeight: '600', color: T.redText }]}>Couldn't load job</Text>
      <Text style={[type.body, { color: T.redText, marginTop: 4 }]}>{message}</Text>
      <View style={{ marginTop: space[3], alignSelf: 'flex-start' }}>
        <Button variant="secondary" onPress={onRetry}>Retry</Button>
      </View>
    </Band>
  );
}
