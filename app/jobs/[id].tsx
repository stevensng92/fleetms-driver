import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader } from '../../components/AppHeader';
import { StatusPill } from '../../components/StatusPill';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RouteCard } from '../../components/RouteCard';
import { RecordState, JOB_NOT_FOUND } from '../../components/RecordState';
import { ClientCard } from '../../components/ClientCard';
import { SpecialInstructionsCard } from '../../components/SpecialInstructionsCard';
import { SurchargesCard } from '../../components/SurchargesCard';
import { PayCard } from '../../components/JobAmountCard';
import { useTokens } from '../../theme/ThemeProvider';
import { fontFor, space, type } from '../../theme/tokens';
import { useClockStyle } from '../../lib/clockPref';
import { useJobDetailByNumber } from '../../lib/queries/jobDetail';
import { jobStatus } from '../../lib/jobStatus';
import { errorWords } from '../../lib/errorWords';
import { useStartJob, useConfirmAssignment, useRejectAssignment } from '../../lib/mutations/jobActions';

// S3 — Job Detail. Reads the real job by job_number; the route param is the
// human-visible JOB-XXX that JobCard shows.
export default function JobDetail() {
  const T = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, isError, error, refetch } = useJobDetailByNumber(id);
  const clock = useClockStyle();

  const startJob = useStartJob();
  const confirmAsg = useConfirmAssignment();
  const rejectAsg = useRejectAssignment();
  // Reject asks first; nothing is sent until the driver confirms.
  const [askingReject, setAskingReject] = useState(false);

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

  // One rule for which buttons a status allows: lib/jobStatus.ts.
  const { action } = jobStatus(job.status);
  const isPending = action === 'acceptReject';
  const isConfirmed = action === 'onMyWay';

  return (
    <AppFrame bottomInset={120}>
      <AppHeader
        title={job.jobNumber}
        onBack={() => router.back()}
        right={<StatusPill kind="job" status={job.status}/>}
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

        <RouteCard stops={job.stops} clock={clock}/>

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
                onPress={() => setAskingReject(true)}
              >
                Reject
              </Button>
              <Button
                full size="lg" style={{ flex: 1 }}
                onPress={async () => {
                  try { await confirmAsg.mutateAsync(job.assignmentId!); }
                  catch (e: any) { Alert.alert('Could not confirm', errorWords(e)); }
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
                Alert.alert('Could not start', errorWords(e));
              }
            }}
          >
            {startJob.isPending ? 'Starting…' : 'On my way'}
          </Button>
        )}

        {action === 'openTrip' && (
          <Button full size="lg" onPress={() => router.replace({ pathname: '/jobs/active', params: { id: job.jobNumber } })}>
            Open active job
          </Button>
        )}

        {action === 'backToJobs' && (
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
        visible={askingReject}
        title={`Reject ${job.jobNumber}?`}
        body="Dispatch will give it to another driver."
        cancelLabel="Keep job"
        confirmLabel="Reject job"
        tone="danger"
        reason={{ label: 'Reason (optional)', placeholder: 'Dispatch will see this.', optional: true }}
        onCancel={() => setAskingReject(false)}
        onConfirm={(reason) => {
          setAskingReject(false);
          rejectAsg.mutateAsync({ assignmentId: job.assignmentId!, reason: reason || undefined })
            .then(() => router.back())
            .catch((e: any) => Alert.alert('Could not reject', errorWords(e)));
        }}
      />
    </AppFrame>
  );
}
