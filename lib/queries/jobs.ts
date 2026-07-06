import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
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

// Human "9:00 AM" time label, MY locale. 12-hour with AM/PM marker — drivers
// shouldn't have to do the 24h math glancing at the card.
function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-MY', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// "Thu, 2 Jul" — only rendered on overdue cards, so a driver can see at a
// glance the pickup was on a past day, not "due today".
function dateOf(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type UpcomingGroup = {
  /** YYYY-MM-DD in driver's local timezone — stable key for the section header */
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
  const now = new Date();
  const startToday = startOfLocalDay(now);
  const startTomorrow      = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startDayAfterTmrw  = new Date(startToday); startDayAfterTmrw.setDate(startDayAfterTmrw.getDate() + 2);
  const endWindow          = new Date(startToday); endWindow.setDate(endWindow.getDate() + 2 + UPCOMING_DAYS);
  const overdueFloor       = new Date(startToday); overdueFloor.setDate(overdueFloor.getDate() - OVERDUE_LOOKBACK_DAYS);

  // Two windows on the embedded job, OR'd together:
  //   1. the scheduled window [today 00:00, +16d) at ANY status, and
  //   2. an overdue still-open job [today-30d, today 00:00) the driver hasn't
  //      closed out yet (status pending/confirmed/in_progress).
  // Without branch 2, a job not marked done by local midnight dropped out of
  // the list entirely and the driver could never complete it ("jobs not
  // showing after the next day").
  const { data, error } = await supabase
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
        status
      )
    `)
    .eq('is_current', true)
    .or(
      `and(pickup_datetime.gte.${startToday.toISOString()},pickup_datetime.lt.${endWindow.toISOString()}),` +
      `and(pickup_datetime.gte.${overdueFloor.toISOString()},pickup_datetime.lt.${startToday.toISOString()},status.in.(${OPEN_STATUSES.join(',')}))`,
      { foreignTable: 'jobs' },
    )
    .order('pickup_datetime', { foreignTable: 'jobs', ascending: true });

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
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      let group = upcomingMap.get(dateKey);
      if (!group) {
        const label = d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' });
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
