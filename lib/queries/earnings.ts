import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { resolveSpecialCommission, normalizeOrgRate, type SpecialCommission } from '../commissionRate';
import { myStartOfDay, myStartOfMonth } from '../timeFormat';

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
  /** RM, jobs.amount (what the client paid the company). Null when the job has
   *  no fare — which a FIXED-FEE job legitimately can (fleetms decision D1: a
   *  fee resolves whatever the fare). This used to coerce to 0, which was
   *  unreachable while commission was percentage-only, because that branch
   *  returns NULL commission on a fareless job so the row showed an em dash
   *  anyway. A fixed-fee row shows a real RM figure, so a coerced "RM 0.00
   *  fare" beside it now reads as a bug rather than as missing data. */
  fare: number | null;
  commission: number | null; // RM, jobs.commission_amount (driver take-home); null when dispatcher hasn't set it
  paymentStatus: EarningsPaymentStatus;
  /** What this job paid, when it wasn't the driver's normal cut — a rate
   *  (20 → "20% comm") or a flat fee (80 → "RM 80 flat"). null = standard rate,
   *  no badge. Same resolveSpecialCommission rule the Jobs list uses. This is
   *  the answer to "why is my take-home different on this one?", and on a fixed
   *  job it is the only thing on the row explaining that the fare had nothing
   *  to do with it. */
  specialCommission: SpecialCommission | null;
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
   *  Drives an inline "{n} jobs awaiting commission" warning when > 0.
   *
   *  Still accurate under fixed-fee pricing: a fee resolves even on a job with
   *  no fare (fleetms decision D1), so a fixed job is never in this count and
   *  the warning can't misread a priced job as unpriced. The narrowed invariant
   *  is "NULL commission ⟺ the fare is unknown, in PERCENTAGE mode" — which is
   *  exactly the set this counts. */
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

// Boundaries are pinned to Malaysia, matching lib/timeFormat.ts. These used to
// use setHours(0,0,0,0) and new Date(y, m, 1), both device-local — so a phone
// outside MY selected a different window than the dates rendered beside it. The
// month case was the worst: on a UTC-negative device the local month can still
// be the previous one, so "This month" silently covered an extra month.
function periodStartIso(p: EarningsPeriod, now = new Date()): string | null {
  if (p === 'all') return null;
  // Last 7 days INCLUSIVE — Sunday-start would diverge across locales, so
  // anchor at "start of the MY day 6 days ago".
  if (p === 'week') return myStartOfDay(now, -6).toISOString();
  return myStartOfMonth(now).toISOString();
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
            pickup_datetime, status,
            commission_rate_override, commission_fixed_amount
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

      // A failed/empty org lookup is NOT fatal — resolveSpecialCommission
      // stays silent on the rate branch without a baseline, so those rows
      // simply render without a badge. Losing a badge beats blocking the
      // driver's earnings.
      //
      // The value-not-just-the-row guard that used to be inlined here now
      // lives in normalizeOrgRate, shared with the other two read paths — it
      // was correct only here, so the same job could badge on Earnings and not
      // on the Jobs list. See lib/commissionRate.ts.
      const orgRate = orgRes.error ? null : normalizeOrgRate(orgRes.data?.driver_commission_rate);

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
            fare:          j.amount == null ? null : Number(j.amount),
            commission:    j.commission_amount == null ? null : Number(j.commission_amount),
            paymentStatus: (j.payment_status as EarningsPaymentStatus) ?? 'unpaid',
            specialCommission: resolveSpecialCommission(
              j.commission_fixed_amount == null ? null : Number(j.commission_fixed_amount),
              j.commission_rate_override == null ? null : Number(j.commission_rate_override),
              orgRate,
            ),
          };
        })
        .filter((r): r is EarningsRow => r !== null);

      // Both totals read the SNAPSHOT the dispatcher stamped at `done`
      // (jobs.commission_amount), never a rate re-applied to the fare here — so
      // a fixed-fee job contributes its flat fee, plus any unpaid pass-through
      // reimbursement the dispatcher folded in, with no arithmetic on this side
      // that could disagree with what the payout pays.
      const commissionTotal = rows.reduce((sum, r) => sum + (r.commission ?? 0), 0);
      // A fareless job contributes 0 to the SUM (there is no fare to add) while
      // still rendering an em dash on its own row — the two are different
      // questions and 0 is the right answer to this one.
      const fareTotal       = rows.reduce((sum, r) => sum + (r.fare ?? 0), 0);
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
