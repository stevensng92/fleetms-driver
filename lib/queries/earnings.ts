import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { resolveSpecialRate } from '../commissionRate';

// Driver Earnings — driver's own completed jobs, scoped via RLS
// (private.is_driver_self on assignments → flow through jobs INNER JOIN).
//
// What's displayed:
//   - Period selector: This Week / This Month / All Time (client-side filter)
//   - Headline RM total = sum of jobs.commission_amount (driver's take-home)
//   - Fare total shown as supporting context (sum of jobs.amount)
//   - Jobs count, Pending count, Avg commission per job
//   - Recent-jobs list with tappable rows → /jobs/{id}
//
// Why commission-led: matches the industry norm (Grab/Uber/Bolt all show
// driver take-home as the headline, not the fare). Drivers care about what
// they're getting paid; fare is supporting info for price verification.

export type EarningsPeriod = 'week' | 'month' | 'all';

export type EarningsPaymentStatus = 'paid' | 'unpaid' | 'waived' | 'refunded';

export type EarningsRow = {
  jobId: string;
  jobNumber: string;
  completedAt: string;       // ISO — date of completion (assignments.completed_at)
                              // falls back to pickup_datetime if no completion
  fare: number;              // RM, jobs.amount (what client paid the company)
  commission: number | null; // RM, jobs.commission_amount (driver take-home); null when dispatcher hasn't set it
  paymentStatus: EarningsPaymentStatus;
  /** Commission rate this job paid at, when it differs from the driver's normal
   *  org rate (e.g. 20 → "20% comm"). null = standard rate, no badge. Same
   *  resolveSpecialRate rule the Jobs list uses — an override pinned to the org
   *  default is NOT special. Explains why a row's take-home doesn't match the
   *  driver's usual cut of the fare. */
  specialRatePct: number | null;
};

export type EarningsSummary = {
  rows: EarningsRow[];
  /** Driver take-home — sum of commission_amount across rows where it's set.
   *  This is the headline number on the Earnings card. */
  commissionTotal: number;
  /** Fare total — sum of jobs.amount across rows. Secondary, supporting info. */
  fareTotal: number;
  jobsCount: number;
  /** Average commission per job. Falls back to 0 when no commissioned jobs. */
  avgCommissionPerJob: number;
  pendingCount: number;       // count where paymentStatus !== 'paid'
  /** Count of rows where commission_amount is null — dispatcher hasn't set it.
   *  Drives an inline "{n} jobs awaiting commission" warning when > 0. */
  missingCommissionCount: number;
  /** True when the query hit ROW_LIMIT, so every total above covers only the
   *  most recent ROW_LIMIT jobs rather than the whole period. Without this the
   *  headline figure silently understates once a driver passes the cap. */
  truncated: boolean;
  /** Completed assignments matching the period, ignoring the row cap. null when
   *  the count couldn't be read. Lets the UI say how much is missing. */
  totalCount: number | null;
};

/** Max rows pulled per period. Totals are computed from what we fetch, so
 *  crossing this is a correctness cliff, not just a display one — hence
 *  `truncated` and the banner it drives. */
export const ROW_LIMIT = 200;

function periodStartIso(p: EarningsPeriod, now = new Date()): string | null {
  if (p === 'all') return null;
  if (p === 'week') {
    // Last 7 days INCLUSIVE — Sunday-start would diverge across locales; keep
    // it simple: anchor at "exactly 7 days ago at midnight local".
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  // month: start of current calendar month, local
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return d.toISOString();
}

export function useDriverEarnings(period: EarningsPeriod) {
  return useQuery({
    queryKey: ['driver-earnings', period],
    queryFn: async (): Promise<EarningsSummary> => {
      const since = periodStartIso(period);

      // Pull all completed assignments for the driver, joined with the job
      // for the actual fare + payment status. RLS narrows to this driver only.
      let query = supabase
        .from('assignments')
        .select(`
          completed_at,
          job:jobs!assignments_job_id_fkey (
            id, job_number, amount, commission_amount, payment_status,
            pickup_datetime, status, commission_rate_override
          )
        `, { count: 'exact' })
        .eq('is_current', true)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(ROW_LIMIT);

      if (since) {
        query = query.gte('completed_at', since);
      }

      // Org default rate rides alongside so each row can tell "this paid my
      // normal rate" from "this one didn't". Same pattern as queries/jobs.ts.
      const [{ data, error, count }, orgRes] = await Promise.all([
        query,
        supabase.from('organizations').select('driver_commission_rate').limit(1).maybeSingle(),
      ]);
      if (error) throw error;

      // A failed/empty org lookup is NOT fatal — resolveSpecialRate returns
      // null without a baseline, so rows simply render without a rate badge.
      // Losing a badge beats blocking the driver's earnings.
      //
      // Guard the VALUE, not just the row. Number(null) is 0, not NaN, and
      // Number.isFinite(0) is true — so a null/absent rate would sail through
      // resolveSpecialRate as a legitimate 0% baseline and badge every
      // overridden job as "different from your usual rate". The column is
      // NOT NULL DEFAULT 0 today, which is the same trap by another door: a
      // newly-onboarded tenant that hasn't set its rate yet reads 0.
      const rawOrgRate = orgRes.error ? null : orgRes.data?.driver_commission_rate;
      const orgRate = rawOrgRate == null || Number(rawOrgRate) <= 0
        ? null
        : Number(rawOrgRate);

      const rows: EarningsRow[] = (data ?? [])
        .map((r: any) => {
          // job may be array-shaped or object-shaped depending on PostgREST
          // resource resolution; normalise.
          const j = Array.isArray(r.job) ? r.job[0] : r.job;
          if (!j) return null;
          // Skip non-done jobs even if assignment is completed — defensive
          if (j.status !== 'done') return null;
          return {
            jobId:         j.id as string,
            jobNumber:     j.job_number as string,
            completedAt:   (r.completed_at as string) ?? (j.pickup_datetime as string),
            fare:          Number(j.amount ?? 0),
            commission:    j.commission_amount == null ? null : Number(j.commission_amount),
            paymentStatus: (j.payment_status as EarningsPaymentStatus) ?? 'unpaid',
            specialRatePct: resolveSpecialRate(
              j.commission_rate_override == null ? null : Number(j.commission_rate_override),
              orgRate,
            ),
          };
        })
        .filter((r): r is EarningsRow => r !== null);

      const commissionTotal = rows.reduce((sum, r) => sum + (r.commission ?? 0), 0);
      const fareTotal       = rows.reduce((sum, r) => sum + r.fare, 0);
      const jobsCount       = rows.length;
      const commissionedJobs = rows.filter(r => r.commission != null).length;
      const avgCommissionPerJob = commissionedJobs > 0 ? commissionTotal / commissionedJobs : 0;
      const pendingCount    = rows.filter(r => r.paymentStatus !== 'paid').length;
      const missingCommissionCount = rows.filter(r => r.commission == null).length;

      return {
        rows,
        commissionTotal,
        fareTotal,
        jobsCount,
        avgCommissionPerJob,
        pendingCount,
        missingCommissionCount,
        // Measured on the raw response, not on `rows` — rows is post-filter
        // (non-done jobs are dropped), so it can sit below the cap even when
        // the query was truncated.
        truncated: (data?.length ?? 0) >= ROW_LIMIT,
        totalCount: count ?? null,
      };
    },
  });
}
