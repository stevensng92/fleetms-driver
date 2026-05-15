import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { StatusKind } from '../../components/StatusPill';

// The Job Detail screen expects: trip meta, route stops, instructions, earnings,
// status, current assignment id (for confirm/reject).
//
// Stops live in their own `job_stops` table (added in pr_ms3). The driver app
// keeps the timeline read-only; the stops table is the source of truth.

function mapStatus(s: string): StatusKind {
  switch (s) {
    case 'pending':     return 'pending';
    case 'confirmed':   return 'confirmed';
    case 'in_progress': return 'progress';
    case 'done':        return 'done';
    case 'rejected':
    case 'cancelled':   return 'voided';
    default:            return 'confirmed';
  }
}

export type JobDetail = {
  jobUuid: string;
  jobNumber: string;
  status: StatusKind;
  rawStatus: string;
  assignmentId: string | null;
  pickupAt: string;
  pickupLocation: string;
  pickupDetail: string | null;
  dropoffLocation: string;
  dropoffDetail: string | null;
  client: string;
  pax: number | null;
  vehicleType: string | null;
  amount: number | null;
  specialInstructions: string | null;
  stops: Array<{
    seq: number;
    kind: string;
    location: string;
    detail: string | null;
    scheduledAt: string | null;
  }>;
};

async function fetchJobDetail(jobUuid: string): Promise<JobDetail> {
  // Pull the job + the current assignment + stops in a single round-trip.
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select(`
      id, job_number, status,
      pickup_datetime, pickup_location, pickup_detail,
      dropoff_location, dropoff_detail,
      client_name, pax, vehicle_type_required, amount, special_instructions,
      assignments!inner ( id, is_current ),
      job_stops ( seq, kind, location, detail, scheduled_at )
    `)
    .eq('id', jobUuid)
    .eq('assignments.is_current', true)
    .order('seq', { foreignTable: 'job_stops', ascending: true })
    .single();

  if (jobErr) throw jobErr;
  if (!job) throw new Error('Job not found');

  const assignment = (job.assignments as any[] | undefined)?.find((a: any) => a.is_current) ?? null;

  return {
    jobUuid: job.id,
    jobNumber: job.job_number,
    status: mapStatus(job.status),
    rawStatus: job.status,
    assignmentId: assignment?.id ?? null,
    pickupAt: job.pickup_datetime,
    pickupLocation: job.pickup_location,
    pickupDetail: job.pickup_detail,
    dropoffLocation: job.dropoff_location,
    dropoffDetail: job.dropoff_detail,
    client: job.client_name,
    pax: job.pax,
    vehicleType: job.vehicle_type_required,
    amount: job.amount === null ? null : Number(job.amount),
    specialInstructions: job.special_instructions,
    stops: ((job.job_stops as any[]) ?? []).map(s => ({
      seq: s.seq,
      kind: s.kind,
      location: s.location,
      detail: s.detail,
      scheduledAt: s.scheduled_at,
    })),
  };
}

export function useJobDetail(jobUuid: string | undefined) {
  return useQuery({
    queryKey: ['job', jobUuid],
    queryFn: () => fetchJobDetail(jobUuid!),
    enabled: Boolean(jobUuid),
  });
}

// Helper for screens that route in via job_number rather than uuid. Looks up
// the uuid, then defers to useJobDetail. Single extra round-trip; cached after.
export function useJobDetailByNumber(jobNumber: string | undefined) {
  return useQuery({
    queryKey: ['job-by-number', jobNumber],
    enabled: Boolean(jobNumber),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id')
        .eq('job_number', jobNumber!)
        .single();
      if (error) throw error;
      return fetchJobDetail(data!.id);
    },
  });
}
