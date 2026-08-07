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
// Rungs 1–2 are THIS JOB. Rungs 3–5 are the driver's NORMAL PAY — the baseline
// a job is measured against. Note that rung 2 beats rung 3: a per-job rate
// outranks a per-driver fee, because precedence is by level first and mode
// second (a per-job decision is the most specific thing anyone typed,
// whichever mode they typed it in).
//
// Two rules decide what a driver actually sees, and they are deliberately
// asymmetric. Collapsing them into one is the likely wrong "cleanup".
//
//   FIXED always surfaces. A flat fee renders in a slot drivers have learned
//   means "percentage", on a screen whose other number is the client's fare, so
//   RM 80 on a RM 500 job reads as the org's ~20% (~RM 100) unless something
//   says otherwise. That is true whether the fee came from the job (rung 1) or
//   from the driver's own default (rung 3) — which is why a freelancer on
//   RM 120 a run sees their fee on EVERY job, not only on the ones a dispatcher
//   priced by hand. There is no "but it's their normal pay" exemption here: the
//   thing being disclosed is the mode, and the mode is unusual every time.
//
//   PERCENTAGE surfaces only when it DIFFERS from the baseline. "Has an
//   override" is not "pays a different rate" — on production, 9 of 16
//   overridden jobs are pinned to exactly the default, so a null-check instead
//   of a value comparison would be wrong on more than half of them.
//
// The baseline is the DRIVER's normal pay, never the org's. A freelancer on a
// 75% split whose jobs are all pinned to 75% is being paid completely
// normally, and comparing those against the org's 15% would badge every single
// job "different from your usual rate" — the driver's usual rate being exactly
// what they were pinned to.
//
// When the baseline is a FEE and the job carries a RATE, the two are in
// different modes and the job badges. A percentage job handed to a driver who
// is normally paid per run is genuinely unusual whatever the numbers say, and
// it is also the one case where the fee they expect does NOT apply.

/**
 * A commission in either of the dispatcher's two modes.
 *
 * Discriminated rather than a bare number because the two are not
 * interchangeable: `{kind:'fixed', amount: 80}` means RM 80 full stop, and
 * rendering it — or doing arithmetic against it — as if it were 80% of the
 * fare is the exact expectation mismatch this type exists to make impossible.
 */
export type CommissionBasis =
  | { kind: 'rate';  pct: number }
  | { kind: 'fixed'; amount: number };

/**
 * What a job advertises, when it is worth advertising at all. Same shape as
 * the baseline it is measured against — the alias exists so call sites read as
 * what they mean, since "the driver's normal pay" is the one thing a
 * *special* commission is not.
 */
export type SpecialCommission = CommissionBasis;

/**
 * A fee we are willing to render, or null to fall through to the next rung.
 *
 * `commission_fixed_amount >= 0` is a DB CHECK, so a negative here means the
 * READ is wrong, not the price — falling through lets a lower rung answer
 * rather than printing a negative fee. Zero does NOT fall through: 0 is falsy
 * and a truthiness check would hide a genuinely-zero fee, which is the
 * driver's whole take-home on that job.
 */
function readFee(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (!Number.isFinite(raw)) return null;
  if (raw < 0) return null;
  return raw;
}

/**
 * A percentage we are willing to render, or null to fall through.
 *
 * Same posture as `readFee` for the same reason — the columns are CHECKed
 * 0–100, so a negative is a broken read. 0 is kept: an explicit 0% is a real
 * arrangement, and it is falsy, so this is the second place a truthiness check
 * would silently drop the job a driver most needs to look at.
 */
function readRate(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (!Number.isFinite(raw)) return null;
  if (raw < 0) return null;
  return raw;
}

/**
 * Compares two rates in integer hundredths, because both sides are
 * `numeric(5,2)` at the DB and arrive as JS doubles — 15.00 vs 15 must compare
 * equal, and float noise must never produce a phantom badge.
 */
function sameRate(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

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
 * The driver's normal pay — ladder rungs 3, 4, 5 — or null when we cannot
 * establish one.
 *
 * Rung 4 accepts an explicit 0 while rung 5 (via `normalizeOrgRate`) rejects
 * it, and that asymmetry is a property of the columns, not an oversight:
 * `drivers.commission_rate` is NULLABLE, so NULL is how "unset" is spelled and
 * a stored 0 is a decision someone made. `organizations.driver_commission_rate`
 * is NOT NULL DEFAULT 0, so it cannot tell those two apart and has to treat 0
 * as unset.
 *
 * A null baseline is not a failure to be papered over — it is the honest "we
 * don't know what normal is for this driver", and the percentage branch of
 * `resolveSpecialCommission` deliberately stays quiet on it.
 */
export function resolveDriverBaseline(
  driverFixed: number | null | undefined,
  driverRate: number | null | undefined,
  orgRate: unknown,
): CommissionBasis | null {
  // Rung 3 — "this freelancer always gets RM 120 a run".
  const fee = readFee(driverFixed);
  if (fee !== null) return { kind: 'fixed', amount: fee };

  // Rung 4 — a per-driver split, e.g. a freelancer on 75%.
  const rate = readRate(driverRate);
  if (rate !== null) return { kind: 'rate', pct: rate };

  // Rung 5 — the org-wide default. Re-normalised here rather than trusted from
  // the caller so a read path that forgets the guard can't reintroduce the
  // phantom-0% baseline; `normalizeOrgRate` is idempotent on an already-clean
  // value.
  const org = normalizeOrgRate(orgRate);
  if (org !== null) return { kind: 'rate', pct: org };

  return null;
}

/**
 * What this job actually pays, walking the full ladder: the job's own pricing
 * if it has any (rungs 1–2), otherwise the driver's baseline (rungs 3–5).
 *
 * Separate from `resolveSpecialCommission` because "what does this pay" and
 * "is that worth saying out loud" are different questions, and only the second
 * one is allowed to return null for a job that is definitely being paid.
 */
export function resolveEffectiveCommission(
  jobFixed: number | null | undefined,
  jobRate: number | null | undefined,
  baseline: CommissionBasis | null | undefined,
): CommissionBasis | null {
  // Rung 1 — a flat fee agreed at booking for this job.
  const fee = readFee(jobFixed);
  if (fee !== null) return { kind: 'fixed', amount: fee };

  // Rung 2 — a per-job rate. Outranks the driver's own fee; see the header.
  const rate = readRate(jobRate);
  if (rate !== null) return { kind: 'rate', pct: rate };

  return baseline ?? null;
}

/**
 * What to advertise on this job, or null when it pays the driver's normal rate
 * in the driver's normal mode.
 *
 * The two branches take opposite postures on a missing baseline, and both are
 * deliberate. A fee resolves regardless, mirroring the dispatcher's decision
 * D1: a fee is owed whatever else is or isn't known. A percentage stays silent,
 * because it cannot prove the rate is unusual and would rather say nothing than
 * label a standard job as special.
 */
export function resolveSpecialCommission(
  jobFixed: number | null | undefined,
  jobRate: number | null | undefined,
  baseline: CommissionBasis | null | undefined,
): SpecialCommission | null {
  const base = baseline ?? null;
  const effective = resolveEffectiveCommission(jobFixed, jobRate, base);
  if (effective === null) return null;

  // A fee is a mode, and the mode is what needs saying. Always surfaces —
  // including when it IS the driver's baseline, which is the whole reason a
  // freelancer paid per run stops seeing the org's percentage on their jobs.
  if (effective.kind === 'fixed') return effective;

  // Percentage from here down. No baseline means no proof it's unusual.
  if (base === null) return null;

  // Baseline is a fee and this job is a percentage: different modes, genuinely
  // different pay, and the one case where the fee the driver expects does not
  // apply. Say so.
  if (base.kind === 'fixed') return effective;

  return sameRate(effective.pct, base.pct) ? null : effective;
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
