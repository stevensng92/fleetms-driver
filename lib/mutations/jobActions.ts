import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

// Wrappers around the public.driver_* RPCs. Each one invalidates the relevant
// list queries so the UI reflects the new state immediately.
//
// Why ['driver-earnings'] is in every list: Earnings is a pay surface, and
// completing a job changes what belongs on it. Without this a driver who
// visited Earnings earlier in the session marks a job done, switches back, and
// does not see it — for the rest of the session. Nothing forces a refetch:
// staleTime is 30s but refetchOnWindowFocus is off (lib/queryClient.ts) and the
// tab stays mounted once visited, so refetchOnMount never fires again. The key
// is the prefix, so it clears all three period tabs at once.
//
// ['job'] is deliberately absent: useJobDetail (the by-uuid variant) was
// removed, so nothing ever populates that key.

export function useConfirmAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data, error } = await supabase.rpc('driver_confirm_assignment', {
        target_assignment_id: assignmentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job-by-number'] });
      qc.invalidateQueries({ queryKey: ['driver-earnings'] });
    },
  });
}

export function useRejectAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, reason }: { assignmentId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('driver_reject_assignment', {
        target_assignment_id: assignmentId,
        reject_reason: reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job-by-number'] });
      qc.invalidateQueries({ queryKey: ['driver-earnings'] });
    },
  });
}

export function useStartJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobUuid: string) => {
      const { data, error } = await supabase.rpc('driver_start_job', {
        target_job_id: jobUuid,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job-by-number'] });
      qc.invalidateQueries({ queryKey: ['driver-earnings'] });
    },
  });
}

export function useCompleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobUuid: string) => {
      const { data, error } = await supabase.rpc('driver_complete_job', {
        target_job_id: jobUuid,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job-by-number'] });
      qc.invalidateQueries({ queryKey: ['driver-earnings'] });
    },
  });
}
