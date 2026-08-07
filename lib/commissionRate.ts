// Commission labelling for the driver app.
//
// The dispatcher prices a driver's cut on a five-rung ladder (fleetms
// docs/driver-payouts.md), top rung first:
//
//   1. jobs.commission_fixed_amount        -- flat fee, this job
//   2. jobs.commission_rate_override       -- %, this job
//   3. drivers.commission_fixed_amount     -- flat fee, this driver
//   4. drivers.commission_rate             -- %, this driver
//   5. organizations.driver_commission_rate
//
// Presence of a fixed amount IS the mode — there is no enum — and the two
// modes are mutually exclusive at each level by DB XOR CHECK, so a fixed-fee
// job has `commission_rate_override` NULL.
//
// This app resolves rungs 1, 2 and 5. Rungs 3 and 4 (the per-DRIVER default)
// are not read anywhere in this repo yet, so a driver whose own default is a
// flat fee still sees nothing on jobs that carry no job-level pricing. That is
// the same blindness this file fixes one level down, and it is tracked as an
// open follow-up rather than fixed here.
//
// The load-bearing rule for the PERCENTAGE branch: "has an override" is NOT
// the same as "pays a different rate". On production, 9 of 16 overridden jobs
// are set to exactly the org default (15%) — dispatchers pin the rate
// explicitly even when it matches. Badging those as special would be wrong on
// more than half the affected jobs, so the rule compares VALUES, never
// null-ness.
//
// The FIXED branch has no such rule, and deliberately so: a flat fee is never
// "the org's percentage rate", whatever that rate happens to be. There is
// nothing to compare, so a fee always surfaces.

/**
 * What to advertise on a job, or null when it pays the driver's normal rate.
 *
 * Discriminated rather than a bare percentage because the two modes are not
 * interchangeable numbers: `{kind:'fixed', amount: 80}` means RM 80 full stop,
 * and rendering it — or doing arithmetic against it — as if it were 80% of the
 * fare is the exact expectation mismatch this type exists to make impossible.
 */
export type SpecialCommission =
  | { kind: 'rate';  pct: number }
  | { kind: 'fixed'; amount: number };

/**
 * Normalises `organizations.driver_commission_rate` into a baseline we are
 * willing to compare against, or null when we are not.
 *
 * Guards the VALUE, not just the row. `Number(null)` is 0, not NaN, and
 * `Number.isFinite(0)` is true — so a null/absent rate would sail through as a
 * legitimate 0% baseline and badge every overridden job as "different from
 * your usual rate". The column is NOT NULL DEFAULT 0 today, which is the same
 * trap by another door: a newly-onboarded tenant that hasn't set its rate yet
 * reads 0.
 *
 * This lives here rather than at each call site because it used to live at
 * exactly one of them. Earnings guarded the value; the Jobs list and Job Detail
 * only guarded the row, so on a tenant sitting at the 0 default the SAME job
 * carried a badge on one screen and not the other.
 */
export function normalizeOrgRate(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Resolves what this job pays, given the job's two pricing columns and the
 * org's default rate.
 *
 * Fixed wins outright — it is the top rung of the ladder, and the DB XOR CHECK
 * means the two job columns can never both be set anyway.
 *
 * A fee resolves even with no org rate to compare against, mirroring the
 * dispatcher's D1 decision: a fee is owed whatever else is or isn't known.
 * The percentage branch keeps the opposite posture and stays silent without a
 * baseline — it cannot prove the rate is unusual, so it says nothing rather
 * than risk labelling a standard job as special.
 */
export function resolveSpecialCommission(
  fixedAmount: number | null | undefined,
  rateOverride: number | null | undefined,
  orgRate: number | null | undefined,
): SpecialCommission | null {
  // Rung 1 — a flat fee agreed at booking for this job.
  //
  // Negative falls through rather than rendering: `commission_fixed_amount >= 0`
  // is a DB CHECK, so a negative here means the read is wrong, not the price.
  // Zero does NOT fall through — 0 is falsy and a truthiness check would hide a
  // genuinely-zero fee, which is the driver's whole take-home on that job.
  if (fixedAmount !== null && fixedAmount !== undefined
      && Number.isFinite(fixedAmount) && fixedAmount >= 0) {
    return { kind: 'fixed', amount: fixedAmount };
  }

  // Rung 2 — a per-job rate. Only "special" when it differs in VALUE from the
  // org default.
  if (rateOverride === null || rateOverride === undefined) return null;
  if (!Number.isFinite(rateOverride)) return null;
  if (orgRate === null || orgRate === undefined || !Number.isFinite(orgRate)) return null;

  // Comparison runs in integer hundredths because both values are
  // `numeric(5,2)` at the DB and arrive as JS doubles — 15.00 vs 15 must
  // compare equal, and float noise must never produce a phantom badge.
  if (Math.round(rateOverride * 100) === Math.round(orgRate * 100)) return null;

  return { kind: 'rate', pct: rateOverride };
}

/**
 * "20%" / "12.5%" / "7.25%" — trailing zeros stripped so the badge reads like
 * a human wrote it, not like a numeric(5,2) column.
 */
export function formatRatePct(rate: number): string {
  const fixed = rate.toFixed(2);
  const trimmed = fixed.replace(/\.?0+$/, '');
  return `${trimmed}%`;
}

/**
 * "RM 80" / "RM 82.50" — cents kept only when there are any.
 *
 * Deliberately unlike the `.toFixed(2)` money elsewhere in the app: this one
 * renders inside a pill that shares a row with the fare and a status chip, and
 * "RM 80" is both how the fee was agreed out loud and two characters shorter.
 * The exact figure a driver reconciles against still shows in full on Earnings.
 *
 * Rounds to sen ONCE and formats the result. Deciding "are there cents?" from
 * `Math.round(amount * 100)` and then formatting the untouched `amount` rounds
 * twice by two different rules, and they disagree at the half-sen boundary:
 * 80.005 rounds up to 8001 sen ("there are cents") but `toFixed(2)` sees a
 * double fractionally BELOW 80.005 and prints "80.00" — a fee rendered as
 * RM 80.00 while the payout pays RM 80.01.
 */
export function formatFixedFee(amount: number): string {
  const sen = Math.round(amount * 100);
  const hasCents = sen % 100 !== 0;
  return `RM ${(sen / 100).toFixed(hasCents ? 2 : 0)}`;
}

/**
 * The pill/card label for either mode. `compact` drops the trailing word for
 * callers that already sit under a label saying it — see CommissionPill.
 */
export function formatSpecialCommission(c: SpecialCommission, compact?: boolean): string {
  return c.kind === 'fixed'
    ? `${formatFixedFee(c.amount)}${compact ? '' : ' flat'}`
    : `${formatRatePct(c.pct)}${compact ? '' : ' comm'}`;
}
