import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { resolveSpecialCommission } from '../commissionRate';
import { fetchCommissionBaseline } from './driverProfile';
import { myStartOfDay } from '../timeFormat';
import type { Job } from '../../components/JobCard';
import { FINISHED_STATUSES } from '../jobStatus';

// The job status is kept exactly as the dispatcher sends it. lib/jobStatus.ts
// is the one place that reads it (words, actions, open or finished) and
// reports a status this app does not know yet to Sentry.

/** One job as downloaded: raw pickup time, no time text. The Jobs screen
 *  splits the list by day (lib/jobGroups.ts) and the card formats the time. */
export type FetchedJob = Omit<Job, 'time' | 'pickupDate'>;

/** How many days past tomorrow we surface on the Jobs tab.
 *  14 days = "next two weeks" — past that, drivers should rely on the dispatcher. */
const UPCOMING_DAYS = 14;

/** How far back we surface still-open jobs whose pickup has already passed. A
 *  job the driver never marked done shouldn't disappear at midnight — but we
 *  don't resurrect ancient stuck rows either. */
const OVERDUE_LOOKBACK_DAYS = 30;


// Pulls the current driver's jobs as one flat list ordered by pickup time:
// open jobs from up to 30 days back, then today + tomorrow + the next 14 days.
// RLS scopes results via private.is_driver_self(driver_id) so the anon JWT
// only sees its own. PostgREST embedding handles the FK join automatically.
// Exported for lib/queries/__tests__/jobs.test.ts; the screen goes through useTodaysJobs.
export async function fetchJobs(): Promise<FetchedJob[]> {
  // Every boundary derived independently from the same MY day, rather than by
  // walking forward from startToday with setDate(). setDate() operates in the
  // DEVICE's local terms, so on a phone that observes DST it would add 23 or 25
  // hours across a transition and slide the MY day boundary off by an hour.
  // Malaysia has no DST; the device might.
  const now = new Date();
  const startToday         = myStartOfDay(now);
  const endWindow          = myStartOfDay(now, 2 + UPCOMING_DAYS);
  const overdueFloor       = myStartOfDay(now, -OVERDUE_LOOKBACK_DAYS);

  // Two windows on the embedded job, OR'd together:
  //   1. the scheduled window [today 00:00, +16d) at ANY status, and
  //   2. an overdue still-open job [today-30d, today 00:00) the driver hasn't
  //      closed out yet (status pending/confirmed/in_progress).
  // Without branch 2, a job not marked done by local midnight dropped out of
  // the list entirely and the driver could never complete it ("jobs not
  // showing after the next day").
  // The driver's own normal pay rides alongside the jobs query so each card can
  // tell "this job pays my normal rate" from "this one doesn't". It is the
  // DRIVER's baseline, not the org's — see lib/commissionRate.ts for why
  // comparing a freelancer's jobs against the org rate badged every one of them.
  const [{ data, error }, baseline] = await Promise.all([
    supabase
      .from('assignments')
      .select(`
        id,
        driver_id,
        is_current,
        vehicle:vehicles!assignments_vehicle_id_fkey ( plate_number ),
        jobs:job_id (
          id,
          job_number,
          pickup_datetime,
          pickup_location,
          dropoff_location,
          client_name,
          pax,
          status,
          commission_rate_override,
          commission_fixed_amount
        )
      `)
      .eq('is_current', true)
      .or(
        `and(pickup_datetime.gte.${startToday.toISOString()},pickup_datetime.lt.${endWindow.toISOString()}),` +
        `and(pickup_datetime.gte.${overdueFloor.toISOString()},pickup_datetime.lt.${startToday.toISOString()},status.not.in.(${FINISHED_STATUSES.join(',')}))`,
        { foreignTable: 'jobs' },
      )
      .order('pickup_datetime', { foreignTable: 'jobs', ascending: true }),
    fetchCommissionBaseline(),
  ]);

  if (error) throw error;

  type Row = {
    assignment_id: string;
    vehicle_plate: string | null;
    job: {
      id: string;
      job_number: string;
      pickup_datetime: string;
      pickup_location: string;
      dropoff_location: string;
      client_name: string;
      pax: number | null;
      status: string;
      commission_rate_override: number | null;
      commission_fixed_amount: number | null;
    };
  };

  const rows: Row[] = (data ?? [])
    .filter((r: any) => r.jobs)
    .map((r: any) => {
      // vehicle embed normalises array vs object shape (PostgREST variance)
      const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
      return {
        assignment_id: r.id,
        vehicle_plate: v?.plate_number ?? null,
        job: r.jobs,
      };
    });

  const toUi = (r: Row): FetchedJob => ({
    id: r.job.job_number,
    jobUuid: r.job.id,
    assignmentId: r.assignment_id,
    // Show the ACTUAL assigned vehicle plate ("WXY 1234"), not the requested
    // type. Driver cares which car they're in, not what the dispatcher asked for.
    vehicle: r.vehicle_plate ?? '—',
    from: r.job.pickup_location,
    to: r.job.dropoff_location,
    client: r.job.client_name,
    pax: r.job.pax ?? 0,
    status: r.job.status,
    // The real pickup time. The screen decides the job's day from it and the
    // card formats it in the driver's Time format.
    pickupAt: r.job.pickup_datetime,
    // null unless this job pays something other than the driver's normal cut —
    // a rate override pinned to the driver's own rate is not "special", but a
    // flat fee always is, including the driver's own standing fee.
    specialCommission: resolveSpecialCommission(
      r.job.commission_fixed_amount == null ? null : Number(r.job.commission_fixed_amount),
      r.job.commission_rate_override == null ? null : Number(r.job.commission_rate_override),
      baseline,
    ),
  });

  // The order() above sorts inside each embedded job, not the assignment rows,
  // so the list is put in pickup order here. Array.sort is stable.
  return rows.map(toUi).sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime());
}

export function useTodaysJobs() {
  // The Time format setting is not part of the key: the screen formats card
  // times itself, so switching it never downloads the list again.
  // Invalidating ['jobs'] still hits this key.
  return useQuery({
    queryKey: ['jobs', 'today'],
    queryFn: () => fetchJobs(),
  });
}
