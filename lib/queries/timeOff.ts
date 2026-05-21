import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type TimeOffReason = 'leave' | 'mc' | 'off_duty';
export type TimeOffStatus = 'pending' | 'approved' | 'rejected';

export type TimeOffEntry = {
  id: string;
  startsAt: string;   // ISO
  endsAt: string;     // ISO
  reason: TimeOffReason;
  notes: string | null;
  status: TimeOffStatus;
  createdAt: string;
};

export const REASON_LABEL: Record<TimeOffReason, string> = {
  leave:    'Leave',
  mc:       'MC',
  off_duty: 'Off duty',
};

// Pulls the current driver's time-off windows. RLS scopes results via
// private.is_driver_self(driver_id). Sorted soonest-first.
export function useDriverTimeOff() {
  return useQuery({
    queryKey: ['driver-time-off'],
    queryFn: async (): Promise<TimeOffEntry[]> => {
      const { data, error } = await supabase
        .from('driver_time_off')
        .select('id, starts_at, ends_at, reason, notes, status, created_at')
        .order('starts_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id:        r.id as string,
        startsAt:  r.starts_at as string,
        endsAt:    r.ends_at as string,
        reason:    r.reason as TimeOffReason,
        notes:     (r.notes as string | null) ?? null,
        status:    r.status as TimeOffStatus,
        createdAt: r.created_at as string,
      }));
    },
  });
}
