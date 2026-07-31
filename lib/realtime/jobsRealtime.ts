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

    // Supabase Realtime caches channels by topic. If a prior mount's cleanup
    // is racing with this mount's effect (which happens in RN Fabric +
    // concurrent rendering — verified on Android v0.3.2+1 via logcat
    // "cannot add `postgres_changes` callbacks after subscribe()"), the
    // .channel(name) call below returns the still-subscribed channel and the
    // next .on(...) throws. The throw propagates to the error boundary and
    // blanks the JobsToday screen.
    //
    // Defensive teardown: remove any existing channel with the same topic
    // BEFORE subscribing. Idempotent — no-op when there's nothing to clean up.
    const expectedTopic = `realtime:driver-jobs-${driverId}`;
    for (const existing of supabase.getChannels()) {
      if (existing.topic === expectedTopic) {
        supabase.removeChannel(existing);
      }
    }

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
          // Earnings too: a dispatcher setting commission_amount, or an
          // assignment reaching completed_at, changes what this screen owes the
          // driver. Without it a mounted Earnings tab shows stale pay.
          qc.invalidateQueries({ queryKey: ['driver-earnings'] });
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
