import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useDriverProfile } from '../queries/driverProfile';

// Live updates for the Jobs tab + notifications inbox.
//
// We subscribe to two tables:
//   * assignments — filtered by driver_id. Most status changes
//     (confirm/start/complete/reassign) touch the assignment row, so this is
//     the primary signal for the Jobs list. New job assignments also create
//     a new assignment row.
//   * push_log — filtered by driver_id. Drives live unread-badge updates so
//     the bell ticks the moment a new push lands.
//
// RLS gates which rows the realtime server actually delivers to each
// subscriber (Supabase Realtime Authorization). The driver_id filter is
// belt-and-braces on top — saves a round-trip when other drivers' rows hit.
//
// One channel per mount, cleaned up on unmount.

export function useJobsRealtime() {
  const qc = useQueryClient();
  const { data: profile } = useDriverProfile();
  const driverId = profile?.id;

  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel(`driver-jobs-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
          filter: `driver_id=eq.${driverId}`,
        },
        () => {
          // Coarse invalidation — refetch the lot. Cheaper than reasoning
          // about which keys this single event touches, and the query is
          // already small.
          qc.invalidateQueries({ queryKey: ['jobs'] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'push_log',
          filter: `driver_id=eq.${driverId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, qc]);
}
