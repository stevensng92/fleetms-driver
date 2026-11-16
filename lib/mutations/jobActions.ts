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

// How long a job action waits for the screens to reload before it finishes.
const REFRESH_WAIT_MS = 2000;

// Resolve when `p` settles or after `ms`, whichever comes first.
function waitAtMost(p: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p.then(() => undefined, () => undefined),
    new Promise<void>(resolve => { timer = setTimeout(resolve, ms); }),
  ]).finally(() => clearTimeout(timer));
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
    // Wait for the screens to reload, so the next screen (the Trip screen after
    // On my way) shows the new status, but never longer than REFRESH_WAIT_MS:
    // on a weak signal a hung reload must not leave a saved action spinning.
    onSuccess: () => waitAtMost(refreshJobs(qc), REFRESH_WAIT_MS),
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
