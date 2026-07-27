import React from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { StatusPill } from '../../components/StatusPill';
import { Button } from '../../components/Button';
import { TimelineStop, Stop } from '../../components/TimelineStop';
import { ClientCard } from '../../components/ClientCard';
import { SpecialInstructionsCard } from '../../components/SpecialInstructionsCard';
import { Icon } from '../../components/Icon';
import { useTokens } from '../../theme/ThemeProvider';
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
            <ActivityIndicator color={T.muted}/>
          </View>
        )}
      </AppFrame>
    );
  }

  const stopsForUi: Stop[] = job.stops.map(s => ({
    kind: s.kind,
    arriveLabel: s.scheduledAt ? 'Arrive' : '—',
    arrive: s.scheduledAt ? new Date(s.scheduledAt).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : '—',
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

  const isPending = job.rawStatus === 'pending';
  const isConfirmed = job.rawStatus === 'confirmed';

  return (
    <AppFrame bottomInset={120}>
      <AppHeader
        title={job.jobNumber}
        onBack={() => router.back()}
        right={<StatusPill kind={job.status}/>}
      />

      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <ClientCard
          clientName={job.client}
          passengerName={job.passengerName}
          passengerPhone={job.passengerPhone}
          pax={job.pax}
          vehicleType={job.vehicleType}
          vehicleModel={job.vehicleModel}
          vehiclePlate={job.vehiclePlate}
        />

        {job.specialInstructions && (
          <SpecialInstructionsCard text={job.specialInstructions}/>
        )}

        <SectionLabel>Route · {stopsForUi.length} stops</SectionLabel>
        <View style={{
          backgroundColor: T.surface, borderRadius: 12,
          paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8, marginBottom: 18,
          shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}>
          {stopsForUi.map((s, i) => (
            <TimelineStop key={i} stop={s} isLast={i === stopsForUi.length - 1}/>
          ))}
        </View>

        {/* Included services (spec #215) — dispatcher-attached surcharges.
            These are services the driver performs on this job and the extra
            money attached to them. Badge language, driver-facing:
              - "Paid in advance"  → cash already handed over; NOT added to pay
              - "Added to your pay" → pass_through still owed, 100% to driver
              - "Counts toward fare" → commissionable, driver earns their % of it
            No section renders when a job carries no surcharges. */}
        {job.surcharges.length > 0 && (
          <>
            <SectionLabel>Included services</SectionLabel>
            <View style={{
              backgroundColor: T.surface, borderRadius: 12,
              paddingHorizontal: 16, paddingVertical: 6, marginBottom: 18,
              shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}>
              {job.surcharges.map((s, i) => (
                <View
                  key={s.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: i === job.surcharges.length - 1 ? 0 : 1,
                    borderBottomColor: T.border,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: T.text }}>{s.name}</Text>
                    <Text style={{
                      fontSize: 11.5, marginTop: 2, fontWeight: '600',
                      color: s.paidInAdvance ? T.mutedLight : T.muted,
                    }}>
                      {s.paidInAdvance
                        ? 'Paid in advance'
                        : s.treatment === 'pass_through' ? 'Added to your pay' : 'Counts toward fare'}
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: 15, fontWeight: '700', letterSpacing: -0.3,
                    color: s.paidInAdvance ? T.mutedLight : T.text,
                    textDecorationLine: s.paidInAdvance ? 'line-through' : 'none',
                  }}>
                    RM {s.amount.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {job.amount !== null && (
          <View style={{
            backgroundColor: T.surface, borderRadius: 12,
            paddingHorizontal: 16, paddingVertical: 14,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}>
            <View>
              <Text style={{ fontSize: 12, color: T.muted, fontWeight: '600' }}>Job amount</Text>
              <Text style={{ fontSize: 11, color: T.mutedLight }}>Before commission</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: T.text, letterSpacing: -0.5 }}>
              RM {job.amount.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {/* Sticky CTA — depends on status */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30,
        backgroundColor: T.page,
      }}>
        {isPending && job.assignmentId && (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                variant="danger" full style={{ flex: 1, minHeight: 56 }}
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
    <View style={{
      marginHorizontal: 16, padding: 16, borderRadius: 12,
      backgroundColor: T.redSoft, borderWidth: 1, borderColor: T.red,
    }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: T.redFg }}>Couldn't load job</Text>
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
