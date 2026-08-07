import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { resolveSpecialCommission, type SpecialCommission } from '../commissionRate';
import { fetchCommissionBaseline } from './driverProfile';
import type { StatusKind } from '../../components/StatusPill';

// The Job Detail screen expects: trip meta, route stops, instructions, earnings,
// status, current assignment id (for confirm/reject).
//
// Stops live in their own `job_stops` table (added in pr_ms3). The driver app
// keeps the timeline read-only; the stops table is the source of truth.

// See lib/queries/jobs.ts:mapStatus for the rationale on the default branch —
// unknown values land in 'voided' (gray) and surface a Sentry warning, never
// silently mislabeled as Confirmed.
function mapStatus(s: string): StatusKind {
  switch (s) {
    case 'pending':     return 'pending';
    case 'confirmed':   return 'confirmed';
    case 'in_progress': return 'progress';
    case 'done':        return 'done';
    case 'rejected':
    case 'cancelled':   return 'voided';
    default:
      try { require('@sentry/react-native').captureMessage(`Unknown job_status: ${s}`, 'warning'); } catch {}
      return 'voided';
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
  /** Name of the actual person the driver is picking up — populated for
   *  corporate + platform-client jobs where the booker isn't the rider. */
  passengerName: string | null;
  /** Tap-to-call number for the passenger; format may be local or international. */
  passengerPhone: string | null;
  pax: number | null;
  /** Type the dispatcher requested (sedan/mpv/etc.) — fallback when no vehicle is assigned yet. */
  vehicleType: string | null;
  /** Actual assigned vehicle on the current assignment. Null when none assigned. */
  vehiclePlate: string | null;
  vehicleModel: string | null;
  amount: number | null;
  /** What this job pays when it isn't the driver's normal cut — either a rate
   *  (20 → "20% comm") or a flat fee (80 → "RM 80 flat"). null = standard rate,
   *  nothing to show. See lib/commissionRate.ts — a rate override pinned to the
   *  org default is not treated as special, but a fee always is. */
  specialCommission: SpecialCommission | null;
  specialInstructions: string | null;
  /** Spec #215 — surcharges attached by the dispatcher. These are services
   *  the driver performs (Overnight, Paging, Accommodation) and money they
   *  earn. RLS (assigned-driver SELECT policy) scopes rows to this driver's
   *  current jobs; snapshot fields mean no catalogue access is needed.
   *  paidInAdvance = the cash was handed over before the trip, so it is
   *  excluded from commission (it is not still owed). */
  surcharges: Array<{
    id: string;
    name: string;
    amount: number;
    treatment: 'commissionable' | 'pass_through';
    paidInAdvance: boolean;
  }>;
  stops: Array<{
    seq: number;
    kind: string;
    location: string;
    detail: string | null;
    scheduledAt: string | null;
    lat: number | null;
    lng: number | null;
  }>;
};

async function fetchJobDetail(jobUuid: string): Promise<JobDetail> {
  // Pull the job + the current assignment + stops in a single round-trip.
  //
  // job_stops disambiguator: there's both a plain FK on job_id AND a composite
  // FK on (org_id, job_id) — PostgREST refuses ambiguous embeds (PGRST201) so
  // we spell the FK by name. Same trick the dispatcher uses in assignments.ts.
  //
  // Current schema (post pr_ms3): position / area / scheduled_arrival_at —
  // the old seq / kind / location / scheduled_at column names from the
  // initial migration were renamed.
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select(`
      id, job_number, status,
      pickup_datetime, pickup_location, pickup_detail, pickup_lat, pickup_lng,
      dropoff_location, dropoff_detail, dropoff_lat, dropoff_lng,
      client_name, passenger_name, passenger_phone,
      pax, vehicle_type_required, amount,
      commission_rate_override, commission_fixed_amount, special_instructions,
      assignments!assignments_job_id_fkey!inner (
        id, is_current,
        vehicle:vehicles!assignments_vehicle_id_fkey ( plate_number, type, model )
      ),
      job_stops!job_stops_job_id_fkey ( position, area, detail, scheduled_arrival_at, lat, lng ),
      job_surcharges ( id, name_snapshot, amount_snapshot, treatment_snapshot, paid_in_advance )
    `)
    .eq('id', jobUuid)
    .eq('assignments.is_current', true)
    .order('position', { foreignTable: 'job_stops', ascending: true })
    .single();

  if (jobErr) throw jobErr;
  if (!job) throw new Error('Job not found');

  // The driver's normal pay, to decide whether this job's RATE is worth
  // surfacing. A failed lookup degrades to "no rate badge"
  // (resolveSpecialCommission stays silent without a baseline) rather than
  // failing the whole screen — and a fixed fee still surfaces, because a fee
  // needs nothing to compare against.
  const baseline = await fetchCommissionBaseline();

  const assignment = (job.assignments as any[] | undefined)?.find((a: any) => a.is_current) ?? null;
  const assignedVehicle = (() => {
    if (!assignment) return null;
    const v = Array.isArray((assignment as any).vehicle)
      ? (assignment as any).vehicle[0]
      : (assignment as any).vehicle;
    return v ? { plate: v.plate_number as string, type: v.type as string, model: (v.model as string | null) ?? null } : null;
  })();

  // job_stops rows describe the route AFTER pickup. We always synthesize a
  // Pickup at index 0 from the job row itself so the timeline UI gets a
  // consistent [Pickup, …, Dropoff] sequence regardless of stop count.
  const realStops = ((job.job_stops as any[]) ?? []);
  const maxPos = realStops.reduce((m, s) => Math.max(m, s.position ?? 0), 0);
  const dbStops = realStops.map((s) => ({
    seq:         s.position as number,
    kind:        s.position === maxPos ? 'Dropoff' : `Stop ${s.position}`,
    location:    s.area as string,
    detail:      (s.detail as string | null) ?? null,
    scheduledAt: (s.scheduled_arrival_at as string | null) ?? null,
    lat:         (s.lat as number | null) ?? null,
    lng:         (s.lng as number | null) ?? null,
  }));

  const pickup = {
    seq: 0,
    kind: 'Pickup',
    location: job.pickup_location,
    detail: job.pickup_detail,
    scheduledAt: job.pickup_datetime,
    lat: (job.pickup_lat as number | null) ?? null,
    lng: (job.pickup_lng as number | null) ?? null,
  };

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
    passengerName: (job.passenger_name as string | null) ?? null,
    passengerPhone: (job.passenger_phone as string | null) ?? null,
    pax: job.pax,
    vehicleType: job.vehicle_type_required,
    vehiclePlate: assignedVehicle?.plate ?? null,
    vehicleModel: assignedVehicle?.model ?? null,
    amount: job.amount === null ? null : Number(job.amount),
    specialCommission: resolveSpecialCommission(
      job.commission_fixed_amount == null ? null : Number(job.commission_fixed_amount),
      job.commission_rate_override == null ? null : Number(job.commission_rate_override),
      baseline,
    ),
    specialInstructions: job.special_instructions,
    // job_surcharges has a single FK path to jobs, so no !fkname disambiguator
    // is needed (unlike job_stops). RLS returns only this driver's rows.
    surcharges: ((job.job_surcharges as any[]) ?? []).map((s) => ({
      id:            s.id as string,
      name:          s.name_snapshot as string,
      amount:        Number(s.amount_snapshot),
      treatment:     s.treatment_snapshot as 'commissionable' | 'pass_through',
      paidInAdvance: Boolean(s.paid_in_advance),
    })),
    stops: [pickup, ...dbStops],
  };
}

// THERE IS DELIBERATELY NO by-uuid HOOK HERE.
//
// `useJobDetail(jobUuid)` used to sit at this spot: exported, zero callers, and
// taking a uuid while its neighbour takes a job_number. That pairing is exactly
// what produced "Cannot coerce the result to a single JSON object" — a caller
// holding one kind of id picked the hook expecting the other, PostgREST matched
// nothing, and `.single()` threw PGRST116. Every screen routes by job_number,
// so the uuid variant was a loaded gun with no upside. It also meant the
// `['job']` key that four mutations invalidated was never populated by anything.
//
// If a by-uuid read is genuinely needed later, call `fetchJobDetail` directly
// rather than re-exporting a second hook that differs only in what a `string`
// means.
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
