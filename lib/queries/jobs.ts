import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Job } from '../../components/JobCard';
import type { StatusKind } from '../../components/StatusPill';

// Maps the dispatcher's job_status enum onto the StatusPill kind used by the UI.
// 'unassigned' should never appear in a driver query, but we map it defensively.
function mapStatus(s: string): StatusKind {
  switch (s) {
    case 'pending':     return 'pending';
    case 'confirmed':   return 'confirmed';
    case 'in_progress': return 'progress';
    case 'done':        return 'done';
    case 'rejected':    return 'voided';
    case 'cancelled':   return 'voided';
    default:            return 'confirmed';
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

export type FetchedJobs = { today: Job[]; tomorrow: Job[] };

// Pulls the current driver's jobs for today + tomorrow. RLS scopes results
// via private.is_driver_self(driver_id) so the anon JWT only sees its own.
//
// Shape: jobs INNER JOIN assignments (is_current = true). PostgREST resource
// embedding picks up the FK relationship automatically.
async function fetchJobs(): Promise<FetchedJobs> {
  const now = new Date();
  const startToday = startOfLocalDay(now);
  const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1);
  const endTomorrow = new Date(startToday); endTomorrow.setDate(endTomorrow.getDate() + 2);

  const { data, error } = await supabase
    .from('assignments')
    .select(`
      id,
      driver_id,
      is_current,
      jobs:job_id (
        id,
        job_number,
        pickup_datetime,
        pickup_location,
        dropoff_location,
        client_name,
        pax,
        vehicle_type_required,
        status
      )
    `)
    .eq('is_current', true)
    .gte('jobs.pickup_datetime', startToday.toISOString())
    .lt('jobs.pickup_datetime', endTomorrow.toISOString())
    .order('pickup_datetime', { foreignTable: 'jobs', ascending: true });

  if (error) throw error;

  type Row = {
    assignment_id: string;
    job: {
      id: string;
      job_number: string;
      pickup_datetime: string;
      pickup_location: string;
      dropoff_location: string;
      client_name: string;
      pax: number | null;
      vehicle_type_required: string | null;
      status: string;
    };
  };

  const rows: Row[] = (data ?? [])
    .filter((r: any) => r.jobs)
    .map((r: any) => ({ assignment_id: r.id, job: r.jobs }));

  const toUi = (r: Row): Job => ({
    id: r.job.job_number,
    jobUuid: r.job.id,
    assignmentId: r.assignment_id,
    time: timeOf(r.job.pickup_datetime),
    vehicle: r.job.vehicle_type_required ?? '—',
    from: r.job.pickup_location,
    to: r.job.dropoff_location,
    client: r.job.client_name,
    pax: r.job.pax ?? 0,
    status: mapStatus(r.job.status),
  });

  const today: Job[] = [];
  const tomorrow: Job[] = [];
  for (const r of rows) {
    const t = new Date(r.job.pickup_datetime).getTime();
    if (t < startTomorrow.getTime()) today.push(toUi(r));
    else tomorrow.push(toUi(r));
  }
  return { today, tomorrow };
}

export function useTodaysJobs() {
  return useQuery({
    queryKey: ['jobs', 'today'],
    queryFn: fetchJobs,
  });
}
