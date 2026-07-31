import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { resolveSpecialRate } from '../commissionRate';
import { formatClock, formatDate, myDateKey, myStartOfDay } from '../timeFormat';
import type { Job } from '../../components/JobCard';
import type { StatusKind } from '../../components/StatusPill';

// Maps the dispatcher's job_status enum onto the StatusPill kind used by the UI.
// 'unassigned' should never appear in a driver query, but we map it defensively.
//
// Unknown values: fall through to 'voided' (neutral gray pill) so the UI
// doesn't lie about the state, and log a Sentry breadcrumb so we hear about
// schema additions (e.g. dispatcher adds 'on_hold' without updating the
// driver app).
function mapStatus(s: string): StatusKind {
  switch (s) {
    case 'pending':     return 'pending';
    case 'confirmed':   return 'confirmed';
    case 'in_progress': return 'progress';
    case 'done':        return 'done';
    case 'rejected':    return 'voided';
    case 'cancelled':   return 'voided';
    default:
      // Lazy-import so this file stays test-importable without RN env.
      try { require('@sentry/react-native').captureMessage(`Unknown job_status: ${s}`, 'warning'); } catch {}
      return 'voided';
  }
}

// "14:30 pm" — 24h digits with the am/pm marker behind them. See
// lib/timeFormat.ts for why the format is shaped that way.
const timeOf = formatClock;

// "Thu, 2 Jul" — only rendered on overdue cards, so a driver can see at a
// glance the pickup was on a past day, not "due today". MY-pinned like every
// other date in the app, so it can't disagree with the time on the same card.
const dateOf = (iso: string) => formatDate(iso, { weekday: true });

export type UpcomingGroup = {
  /** YYYY-MM-DD in Malaysian time — stable key for the section header */
  dateKey: string;
  /** Human label, e.g. "Thu 22 May" */
  label: string;
  jobs: Job[];
};

export type FetchedJobs = {
  /** Past, still-open jobs (not done/cancelled/rejected) carried over from
   *  previous days so they don't vanish at midnight before the driver closes
   *  them out. Bounded to the last OVERDUE_LOOKBACK_DAYS. */
  overdue: Job[];
  today: Job[];
  tomorrow: Job[];
  /** Day-by-day groupings from day-after-tomorrow up to UPCOMING_DAYS out. */
  upcoming: UpcomingGroup[];
};

/** How many days past tomorrow we surface on the Jobs tab.
 *  14 days = "next two weeks" — past that, drivers should rely on the dispatcher. */
const UPCOMING_DAYS = 14;

/** How far back we surface still-open jobs whose pickup has already passed. A
 *  job the driver never marked done shouldn't disappear at midnight — but we
 *  don't resurrect ancient stuck rows either. */
const OVERDUE_LOOKBACK_DAYS = 30;

/** job_status values still actionable by the driver (confirm / start / mark
 *  done). Terminal states (done/cancelled/rejected) are NOT carried over once
 *  their pickup is in the past — only open work follows the driver forward. */
const OPEN_STATUSES = ['pending', 'confirmed', 'in_progress'] as const;

// Pulls the current driver's upcoming jobs (today + tomorrow + next 14 days).
// RLS scopes results via private.is_driver_self(driver_id) so the anon JWT
// only sees its own. PostgREST embedding handles the FK join automatically.
async function fetchJobs(): Promise<FetchedJobs> {
  // Every boundary derived independently from the same MY day, rather than by
  // walking forward from startToday with setDate(). setDate() operates in the
  // DEVICE's local terms, so on a phone that observes DST it would add 23 or 25
  // hours across a transition and slide the MY day boundary off by an hour.
  // Malaysia has no DST; the device might.
  const now = new Date();
  const startToday         = myStartOfDay(now);
  const startTomorrow      = myStartOfDay(now, 1);
  const startDayAfterTmrw  = myStartOfDay(now, 2);
  const endWindow          = myStartOfDay(now, 2 + UPCOMING_DAYS);
  const overdueFloor       = myStartOfDay(now, -OVERDUE_LOOKBACK_DAYS);

  // Two windows on the embedded job, OR'd together:
  //   1. the scheduled window [today 00:00, +16d) at ANY status, and
  //   2. an overdue still-open job [today-30d, today 00:00) the driver hasn't
  //      closed out yet (status pending/confirmed/in_progress).
  // Without branch 2, a job not marked done by local midnight dropped out of
  // the list entirely and the driver could never complete it ("jobs not
  // showing after the next day").
  // The org's default commission rate rides alongside the jobs query so each
  // card can tell "this job pays my normal rate" from "this one doesn't".
  // RLS ("drivers can see their own org") scopes this to exactly the driver's
  // own org, and `driver_commission_rate` is granted to `authenticated`.
  // limit(1) guards the theoretical multi-org driver rather than throwing.
  const [{ data, error }, orgRes] = await Promise.all([
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
          commission_rate_override
        )
      `)
      .eq('is_current', true)
      .or(
        `and(pickup_datetime.gte.${startToday.toISOString()},pickup_datetime.lt.${endWindow.toISOString()}),` +
        `and(pickup_datetime.gte.${overdueFloor.toISOString()},pickup_datetime.lt.${startToday.toISOString()},status.in.(${OPEN_STATUSES.join(',')}))`,
        { foreignTable: 'jobs' },
      )
      .order('pickup_datetime', { foreignTable: 'jobs', ascending: true }),
    supabase.from('organizations').select('driver_commission_rate').limit(1).maybeSingle(),
  ]);

  if (error) throw error;

  // A failed/empty org lookup is NOT fatal — resolveSpecialRate returns null
  // without a default to compare against, so every job simply renders without
  // a rate badge. Losing a badge beats blocking the driver's job list.
  const orgRate = orgRes.error || !orgRes.data
    ? null
    : Number(orgRes.data.driver_commission_rate);

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

  const toUi = (r: Row): Job => ({
    id: r.job.job_number,
    jobUuid: r.job.id,
    assignmentId: r.assignment_id,
    // Show the ACTUAL assigned vehicle plate ("WXY 1234"), not the requested
    // type. Driver cares which car they're in, not what the dispatcher asked for.
    vehicle: r.vehicle_plate ?? '—',
    time: timeOf(r.job.pickup_datetime),
    pickupDate: dateOf(r.job.pickup_datetime),
    from: r.job.pickup_location,
    to: r.job.dropoff_location,
    client: r.job.client_name,
    pax: r.job.pax ?? 0,
    status: mapStatus(r.job.status),
    // null unless this job's rate actually differs from the driver's normal
    // one — an override pinned to the default rate is not "special".
    specialRatePct: resolveSpecialRate(
      r.job.commission_rate_override === null ? null : Number(r.job.commission_rate_override),
      orgRate,
    ),
  });

  const overdue: Job[] = [];
  const today: Job[] = [];
  const tomorrow: Job[] = [];
  // Map of YYYY-MM-DD → group (preserves insertion order, which is already
  // chronological because the query orders by pickup_datetime ascending).
  const upcomingMap = new Map<string, UpcomingGroup>();

  for (const r of rows) {
    const d = new Date(r.job.pickup_datetime);
    const t = d.getTime();
    if (t < startToday.getTime()) {
      // Pickup already passed and the job is still open (guaranteed by the
      // query's status filter) — carry it over so it can still be completed.
      overdue.push(toUi(r));
    } else if (t < startTomorrow.getTime()) {
      today.push(toUi(r));
    } else if (t < startDayAfterTmrw.getTime()) {
      tomorrow.push(toUi(r));
    } else {
      const dateKey = myDateKey(d);
      let group = upcomingMap.get(dateKey);
      if (!group) {
        const label = formatDate(d, { weekday: true });
        group = { dateKey, label, jobs: [] };
        upcomingMap.set(dateKey, group);
      }
      group.jobs.push(toUi(r));
    }
  }

  return { overdue, today, tomorrow, upcoming: Array.from(upcomingMap.values()) };
}

export function useTodaysJobs() {
  return useQuery({
    queryKey: ['jobs', 'today'],
    queryFn: fetchJobs,
  });
}
