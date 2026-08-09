import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { resolveSpecialCommission, type SpecialCommission } from '../commissionRate';
import { fetchCommissionBaseline } from './driverProfile';
import { periodRange, type EarningsPeriod } from '../earningsPeriod';

// The period type and its date arithmetic live in ../earningsPeriod so they can
// be tested without standing up a Supabase client. Re-exported here so callers
// that already import the hooks don't need a second import path.
export {
  monthPeriod, weekPeriod, keyOf, modeOf, periodRange, periodCount,
  periodKeysDesc, periodHeadline, emptyStateText, MAX_PERIODS,
  type EarningsPeriod, type EarningsMode,
  type EarningsMonthPeriod, type EarningsWeekPeriod,
} from '../earningsPeriod';

// Driver Earnings — driver's own completed jobs, scoped via RLS.
//
// What's displayed:
//   - Period selector: This Week / This Month / each past month / All Time
//   - Headline RM total = sum of jobs.commission_amount (driver's take-home)
//   - Fare total shown as supporting context (sum of jobs.amount)
//   - Jobs count, Pending count, Avg commission per job
//   - Recent-jobs list with tappable rows → /jobs/{id}
//
// Why commission-led: matches the industry norm (Grab/Uber/Bolt all show
// driver take-home as the headline, not the fare). Drivers care about what
// they're getting paid; fare is supporting info for price verification.
//
// PERIODS ARE BUCKETED BY MY-LOCAL PICKUP DATE, NOT COMPLETION TIME.
//
// This is the single most load-bearing decision in the file, and it changed in
// v0.8.0. The screen used to filter on `assignments.completed_at`, while the
// dispatcher's `create_driver_payout` aggregates over `done` jobs whose
// MY-local PICKUP date falls in the period. Those disagree whenever a job is
// marked done on a different day than it ran — which on prod was 185 of 671
// completed jobs, and 37 of them landed in a different MONTH. In July 2026 the
// two bases differed by RM 1,429 fleet-wide, ~12% of the month.
//
// That gap was survivable while "This month" was a moving window nobody
// reconciled. It stopped being survivable the moment drivers could open a
// finished month and compare it against the payslip they were actually paid —
// which is the entire point of the past-month selector. A screen a driver uses
// to check they were paid correctly has to bucket money the same way the payer
// does, so the two now agree by construction.
//
// Consequence to expect: This Week / This Month totals moved for drivers who
// close jobs late. The new numbers are the correct ones; someone may still
// report the change as a regression, exactly as the v0.7.0 expense-date fix did.
//
// Two other divergences from `create_driver_payout` were measured and are NOT
// bugs today, but would become ones if the data changed:
//   - the payout attributes money via `jobs.commission_driver_id` (snapshotted
//     at done, immutable) while this screen attributes via the driver's CURRENT
//     assignment. 0 of 672 done jobs disagree on prod.
//   - the payout has no completion requirement at all. 0 done jobs lack a
//     completed_at on prod, and this query no longer requires one either.
// Both were re-checked 2026-08-09.


export type EarningsPaymentStatus = 'paid' | 'unpaid' | 'waived' | 'refunded';

export type EarningsRow = {
  jobId: string;
  jobNumber: string;
  /** ISO — the job's PICKUP instant, which is both the date shown on the row
   *  and the date that decided which period the row falls in. Those must be the
   *  same field: showing a completion date under a month heading the pickup
   *  date chose is how a July row ends up displaying an August date. */
  jobDate: string;
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

/**
 * The past months this driver actually has completed work in, newest first and
 * EXCLUDING the current month (the "This month" chip already covers it).
 *
 * Derived from one row — the driver's earliest completed job — rather than by
 * fetching distinct months, because PostgREST has no DISTINCT and the
 * alternative is pulling every job just to reduce it to a handful of strings.
 *
 * Deriving the range instead of listing real months means a month the driver
 * didn't work still gets a chip, landing on the existing empty state. That is
 * the right trade: a gap in the strip is honest ("you had no jobs in June"),
 * whereas a fixed 12-month lookback would offer months from before the driver
 * joined, and a distinct-month query costs the whole table to avoid it.
 */
/**
 * The pickup instant of this driver's EARLIEST completed job, or null if they
 * have none. `periodCount` turns it into how many periods the pager offers.
 *
 * One row, not a distinct-periods query: PostgREST has no DISTINCT, and the
 * alternative is pulling every job just to reduce it to a handful of keys. The
 * pager wants a count anyway, not a list — it generates its own keys from
 * "now", so all it needs from the server is how far back to go.
 *
 * Deriving the span rather than listing real periods means a month the driver
 * didn't work still gets a page, landing on the empty state. That is the right
 * trade: a quiet month is a true answer ("you had no jobs in June"), and
 * skipping it would make the dots misreport how far back you are.
 */
export function useEarningsHistoryStart() {
  return useQuery({
    queryKey: ['driver-earnings-history-start'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('pickup_datetime, assignments!assignments_job_id_fkey!inner ( is_current )')
        .eq('status', 'done')
        .eq('assignments.is_current', true)
        .order('pickup_datetime', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data?.pickup_datetime as string | undefined) ?? null;
    },
    // The answer only changes when a driver logs their very first job, so this
    // need not be fresh. The period COUNT derived from it still moves with the
    // clock, because that is computed against `now` at render.
    staleTime: 60 * 60 * 1000,
  });
}

export function useDriverEarnings(period: EarningsPeriod) {
  return useQuery({
    queryKey: ['driver-earnings', period],
    queryFn: async (): Promise<EarningsSummary> => {
      const { since, until } = periodRange(period);

      // Reads FROM `jobs`, not from `assignments` as it used to.
      //
      // The period filter and the sort both key on `jobs.pickup_datetime`, and
      // PostgREST can only apply those natively to the table being selected
      // from. Ordering through an embed (`{ referencedTable: 'job' }`) sorts the
      // EMBEDDED rows, not the parent ones — on a to-one embed that is a no-op,
      // so the `.limit(ROW_LIMIT)` below would have kept an arbitrary 200 jobs
      // rather than the 200 most recent. Silent, and exactly wrong on the
      // screen where truncation already needs a banner to be honest.
      //
      // Still scoped to this driver, by two independent gates: `jobs` carries a
      // driver SELECT policy (`private.is_assigned_driver_for_job`), and the
      // INNER embed on `assignments` is itself filtered by that table's
      // `private.is_driver_self` policy — so the join can only match the
      // caller's own current assignment.
      //
      // `status = 'done'` moved into the query. It was a client-side skip,
      // which meant non-done rows consumed ROW_LIMIT slots before being thrown
      // away, and made `count` answer a different question than the rows did.
      let query = supabase
        .from('jobs')
        .select(`
          id, job_number, amount, commission_amount, payment_status,
          pickup_datetime, status,
          commission_rate_override, commission_fixed_amount,
          assignments!assignments_job_id_fkey!inner ( is_current )
        `, { count: 'exact' })
        .eq('status', 'done')
        .eq('assignments.is_current', true)
        .order('pickup_datetime', { ascending: false })
        .limit(ROW_LIMIT);

      if (since) query = query.gte('pickup_datetime', since);
      if (until) query = query.lt('pickup_datetime', until);

      // The driver's own normal pay rides alongside so each row can tell "this
      // paid my normal rate" from "this one didn't". Same pattern as
      // queries/jobs.ts, and the same shared reader, so a rate can no longer be
      // the driver's on one screen and the org's on another.
      //
      // A failed/empty lookup is NOT fatal — resolveSpecialCommission stays
      // silent on the rate branch without a baseline, so those rows simply
      // render without a badge. Losing a badge beats blocking the driver's
      // earnings.
      const [{ data, error, count }, baseline] = await Promise.all([
        query,
        fetchCommissionBaseline(),
      ]);
      if (error) throw error;

      const rows: EarningsRow[] = (data ?? [])
        .map((j: any) => {
          if (!j) return null;
          // Belt-and-braces: the query already filters status, so this can only
          // fire if that filter is ever dropped.
          if (j.status !== 'done') return null;
          return {
            jobId:         j.id as string,
            jobNumber:     j.job_number as string,
            jobDate:       j.pickup_datetime as string,
            fare:          j.amount == null ? null : Number(j.amount),
            commission:    j.commission_amount == null ? null : Number(j.commission_amount),
            paymentStatus: (j.payment_status as EarningsPaymentStatus) ?? 'unpaid',
            specialCommission: resolveSpecialCommission(
              j.commission_fixed_amount == null ? null : Number(j.commission_fixed_amount),
              j.commission_rate_override == null ? null : Number(j.commission_rate_override),
              baseline,
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
