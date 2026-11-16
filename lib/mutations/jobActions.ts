import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

// The four job actions (Accept, Reject, Start, Complete) and the one list of
// what refreshes after any job change. The live listener
// (lib/realtime/jobsRealtime.ts) uses the same refreshJobs, so an action and a
// live update can never refresh different screens.

// Every query that shows a job. Keys are prefixes: ['job-by-number'] covers
// every open job or Trip screen, ['driver-earnings'] every Earnings period.
//
// Earnings is here because it is a pay surface: completing a job, or the
// dispatcher setting a commission, changes what belongs on it, and nothing
// else forces a refetch (refetchOnWindowFocus is off in lib/queryClient.ts and
// a visited tab stays mounted).
const JOB_QUERY_KEYS: readonly (readonly string[])[] = [
  ['jobs'],
  ['job-by-number'],
  ['driver-earnings'],
  ['driver-earnings-history-start'],
];

/** Mark every query that shows a job stale, so mounted screens refetch. */
export async function refreshJobs(qc: QueryClient): Promise<void> {
  await Promise.all(JOB_QUERY_KEYS.map(queryKey => qc.invalidateQueries({ queryKey })));
}

// One job action: call the server, then refresh every screen that shows a job.
function useJobAction<TArg>(call: (arg: TArg) => PromiseLike<{ data: unknown; error: unknown }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (arg: TArg) => {
      const { data, error } = await call(arg);
      if (error) throw error;
      return data;
    },
    // Fire and forget: the action is done once the server saves it. Returning
    // the refresh would keep the button spinning until every screen reloads,
    // which on a weak signal looks like a stuck "Marking…".
    onSuccess: () => { void refreshJobs(qc); },
  });
}

export function useConfirmAssignment() {
  return useJobAction((assignmentId: string) =>
    supabase.rpc('driver_confirm_assignment', { target_assignment_id: assignmentId }));
}

export function useRejectAssignment() {
  return useJobAction(({ assignmentId, reason }: { assignmentId: string; reason?: string }) =>
    supabase.rpc('driver_reject_assignment', {
      target_assignment_id: assignmentId,
      reject_reason: reason ?? null,
    }));
}

export function useStartJob() {
  return useJobAction((jobUuid: string) =>
    supabase.rpc('driver_start_job', { target_job_id: jobUuid }));
}

export function useCompleteJob() {
  return useJobAction((jobUuid: string) =>
    supabase.rpc('driver_complete_job', { target_job_id: jobUuid }));
}
