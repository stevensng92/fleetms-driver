import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { refreshJobs } from '../mutations/jobActions';

// Live updates: while a driver is signed in, a change the dispatcher makes to
// one of their assignments or jobs refreshes every screen that shows a job
// (refreshJobs, the same list the job actions use). Mounted once at the app's
// root, so it also runs when a push opens the app straight onto a job screen.
//
// We subscribe to three tables on one channel:
//   * assignments — filtered by driver_id: a new job, a reassignment, a
//     confirm/start/complete made elsewhere.
//   * jobs — a cancel, a new pickup time or address. jobs has no driver_id
//     column, so no filter: RLS decides which rows the realtime server
//     delivers (Supabase Realtime Authorization), and a driver can read only
//     the jobs assigned to them (drivers are not org members for
//     is_member_of). Stop-only edits do not touch the jobs row and are not
//     published, so they do not arrive live yet (dispatcher follow-up).
//   * push_log — filtered by driver_id: the unread badge ticks the moment a
//     new push lands.
//
// Coming back to the front runs the same refresh: realtime only delivers while
// the app is open and connected, so a change made while the phone slept would
// otherwise stay hidden (refetchOnWindowFocus is off in lib/queryClient.ts).
function reportLookupError(message: string) {
  // Lazy require so a test that never meets one needs no Sentry mock.
  try { require('@sentry/react-native').captureMessage(`Live updates: driver lookup failed: ${message}`, 'warning'); } catch {}
}

export function useLiveUpdates(signedIn: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    let connecting = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Coming back to the front catches up, and retries a connect that failed
    // (no signal at sign-in) so the rest of the sign-in still gets live updates.
    const appSub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      void refreshJobs(qc);
      if (!channel) void connect();
    });

    // Look the driver up on every sign-in rather than reading the cached
    // driver profile: that query key is not per driver, so after a driver
    // switch it could still hold the previous driver's id.
    async function connect() {
      if (connecting || channel) return;
      connecting = true;
      let driverId: string | undefined;
      try {
        const { data, error } = await supabase.from('drivers').select('id').maybeSingle();
        // Reported so a phone left without live updates shows up in Sentry;
        // still retried when the app comes back to the front.
        if (error) reportLookupError(error.message);
        driverId = (data as { id?: string } | null)?.id;
      } catch { /* offline: retried when the app comes back to the front */ }
      connecting = false;
      if (cancelled || !driverId || channel) return;

      // Supabase Realtime caches channels by topic. If a prior mount's cleanup
      // is racing with this effect (RN Fabric + concurrent rendering, seen on
      // Android v0.3.2+1: "cannot add `postgres_changes` callbacks after
      // subscribe()"), .channel(name) returns the still-subscribed channel and
      // the next .on(...) throws. Remove any channel with the same topic first.
      const expectedTopic = `realtime:driver-jobs-${driverId}`;
      for (const existing of supabase.getChannels()) {
        if (existing.topic === expectedTopic) supabase.removeChannel(existing);
      }

      const ch = supabase
        .channel(`driver-jobs-${driverId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'assignments', filter: `driver_id=eq.${driverId}` },
          () => { void refreshJobs(qc); },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'jobs' },
          () => { void refreshJobs(qc); },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'push_log', filter: `driver_id=eq.${driverId}` },
          () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); },
        );
      channel = ch;
      // A connection that drops after it is set up (the server closed it, or
      // it errored or timed out) is dropped here, so the next return to the
      // front reconnects instead of keeping a dead channel until sign-out.
      ch.subscribe(status => {
        if (cancelled || channel !== ch) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          channel = null;
          supabase.removeChannel(ch);
        }
      });
    }
    void connect();

    return () => {
      cancelled = true;
      appSub.remove();
      if (channel) supabase.removeChannel(channel);
    };
  }, [signedIn, qc]);
}
