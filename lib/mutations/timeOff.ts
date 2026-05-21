import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { TimeOffReason } from '../queries/timeOff';

export type RequestTimeOffInput = {
  /** Local YYYY-MM-DD — sent to the RPC as the start of that day in UTC.
   *  The dispatcher's strict_scheduling check uses the same range, so day-level
   *  granularity is sufficient. */
  startDate: string;
  /** Local YYYY-MM-DD, INCLUSIVE. We convert to the half-open [start, end+1d)
   *  the schema expects, so "17 to 19 May" is 3 full days. */
  endDate: string;
  reason: TimeOffReason;
  notes?: string;
};

function toIsoStartOfDay(ymd: string): string {
  // Append 'T00:00:00' so it's parsed as local-midnight, then send as ISO.
  // The driver's expectation is "days off in their local timezone".
  return new Date(`${ymd}T00:00:00`).toISOString();
}

function toIsoEndOfDay(ymd: string): string {
  // Half-open range: end day + 1 day at 00:00 local.
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export function useRequestTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RequestTimeOffInput) => {
      const { data, error } = await supabase.rpc('request_driver_time_off', {
        p_starts_at: toIsoStartOfDay(input.startDate),
        p_ends_at:   toIsoEndOfDay(input.endDate),
        p_reason:    input.reason,
        p_notes:     input.notes?.trim() || null,
      });
      if (error) throw error;
      return data as unknown as string; // id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-time-off'] });
    },
  });
}

export function useCancelTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancel_driver_time_off', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-time-off'] });
    },
  });
}
