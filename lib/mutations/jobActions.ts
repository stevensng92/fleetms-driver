import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

// Wrappers around the public.driver_* RPCs. Each one invalidates the relevant
// list queries so the UI reflects the new state immediately.

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
      qc.invalidateQueries({ queryKey: ['job'] });
      qc.invalidateQueries({ queryKey: ['job-by-number'] });
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
      qc.invalidateQueries({ queryKey: ['job'] });
      qc.invalidateQueries({ queryKey: ['job-by-number'] });
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
      qc.invalidateQueries({ queryKey: ['job'] });
      qc.invalidateQueries({ queryKey: ['job-by-number'] });
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
      qc.invalidateQueries({ queryKey: ['job'] });
      qc.invalidateQueries({ queryKey: ['job-by-number'] });
    },
  });
}
