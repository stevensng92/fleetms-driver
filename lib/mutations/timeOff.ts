import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { TimeOffReason } from '../queries/timeOff';
import { myStartOfDay } from '../timeFormat';

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

// Both boundaries anchor to MALAYSIAN midnight, matching lib/timeFormat.ts and
// the dispatcher's own range checks.
//
// These used to build `new Date(\`${ymd}T00:00:00\`)`, which JS parses as
// DEVICE-local (a datetime string without an offset is local; a bare
// YYYY-MM-DD would have been UTC — the two forms disagree, which is the whole
// footgun). On a phone outside MY that shifted a requested day off by hours,
// and the dispatcher's strict_scheduling check then compared it against a MY
// range, so a day off could land against the wrong day.
function toIsoStartOfDay(ymd: string): string {
  return myStartOfDay(`${ymd}T00:00:00+08:00`).toISOString();
}

function toIsoEndOfDay(ymd: string): string {
  // Half-open range: the end day is INCLUSIVE, so the bound is the next MY midnight.
  return myStartOfDay(`${ymd}T00:00:00+08:00`, 1).toISOString();
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
