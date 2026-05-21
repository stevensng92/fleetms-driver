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

// Human "09:00" time label, MY locale.
function timeOf(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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
  today: Job[];
  tomorrow: Job[];
  /** Day-by-day groupings from day-after-tomorrow up to UPCOMING_DAYS out. */
  upcoming: UpcomingGroup[];
};

/** How many days past tomorrow we surface on the Jobs tab.
 *  14 days = "next two weeks" — past that, drivers should rely on the dispatcher. */
const UPCOMING_DAYS = 14;

// Pulls the current driver's upcoming jobs (today + tomorrow + next 14 days).
// RLS scopes results via private.is_driver_self(driver_id) so the anon JWT
// only sees its own. PostgREST embedding handles the FK join automatically.
async function fetchJobs(): Promise<FetchedJobs> {
  const now = new Date();
  const startToday = startOfLocalDay(now);
  const startTomorrow      = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startDayAfterTmrw  = new Date(startToday); startDayAfterTmrw.setDate(startDayAfterTmrw.getDate() + 2);
  const endWindow          = new Date(startToday); endWindow.setDate(endWindow.getDate() + 2 + UPCOMING_DAYS);

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
    .gte('jobs.pickup_datetime', startToday.toISOString())
    .lt('jobs.pickup_datetime', endWindow.toISOString())
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
    from: r.job.pickup_location,
    to: r.job.dropoff_location,
    client: r.job.client_name,
    pax: r.job.pax ?? 0,
    status: mapStatus(r.job.status),
  });

  const today: Job[] = [];
  const tomorrow: Job[] = [];
  // Map of YYYY-MM-DD → group (preserves insertion order, which is already
  // chronological because the query orders by pickup_datetime ascending).
  const upcomingMap = new Map<string, UpcomingGroup>();

  for (const r of rows) {
    const d = new Date(r.job.pickup_datetime);
    const t = d.getTime();
    if (t < startTomorrow.getTime()) {
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

  return { today, tomorrow, upcoming: Array.from(upcomingMap.values()) };
}

export function useTodaysJobs() {
  return useQuery({
    queryKey: ['jobs', 'today'],
    queryFn: fetchJobs,
  });
}
