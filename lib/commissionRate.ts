// Commission-rate labelling for the driver app.
//
// A job can carry `jobs.commission_rate_override` — a per-job rate that
// replaces the org's flat `organizations.driver_commission_rate`. Drivers
// should see when THIS job pays at a different rate than their normal one,
// on both the Jobs list and Job Detail.
//
// The load-bearing detail: "has an override" is NOT the same as "pays a
// different rate". On production today, 9 of 16 overridden jobs are set to
// exactly the org default (15%) — dispatchers pin the rate explicitly even
// when it matches. Badging those as special would be wrong on more than half
// the affected jobs, so the rule compares VALUES, never null-ness.

/**
 * The rate to advertise on this job, or null when it pays the normal rate.
 *
 * Returns null when:
 *   - there is no override (the overwhelmingly common case),
 *   - the override equals the org default (explicit-but-standard pinning), or
 *   - the org default is unknown (query failed / driver has no org row) —
 *     we cannot prove the rate is unusual, so we say nothing rather than
 *     risk labelling a standard job as special.
 *
 * Comparison runs in integer hundredths because both values are
 * `numeric(5,2)` at the DB and arrive as JS doubles — 15.00 vs 15 must
 * compare equal, and float noise must never produce a phantom badge.
 */
export function resolveSpecialRate(
  override: number | null | undefined,
  orgRate: number | null | undefined,
): number | null {
  if (override === null || override === undefined) return null;
  if (!Number.isFinite(override)) return null;
  if (orgRate === null || orgRate === undefined || !Number.isFinite(orgRate)) return null;

  const overrideHundredths = Math.round(override * 100);
  const orgHundredths = Math.round(orgRate * 100);
  if (overrideHundredths === orgHundredths) return null;

  return override;
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
