import { resolveSpecialRate, formatRatePct } from '../commissionRate';

// The load-bearing rule: "has an override" is NOT "pays a different rate".
// On production, 9 of 16 overridden jobs are pinned to exactly the org default,
// so a null-check instead of a value comparison would wrongly badge more than
// half the affected jobs. These tests exist to keep that distinction.

describe('resolveSpecialRate', () => {
  it('returns the rate when it genuinely differs from the org default', () => {
    expect(resolveSpecialRate(20, 15)).toBe(20);
    expect(resolveSpecialRate(7.5, 15)).toBe(7.5);
  });

  it('returns null when there is no override at all', () => {
    expect(resolveSpecialRate(null, 15)).toBeNull();
    expect(resolveSpecialRate(undefined, 15)).toBeNull();
  });

  it('returns null when the override is pinned to the org default', () => {
    // The prod-majority case: a dispatcher set the rate explicitly, to the
    // value it already was. Not special, must not badge.
    expect(resolveSpecialRate(15, 15)).toBeNull();
  });

  it('treats 15 and 15.00 as equal', () => {
    // Both sides are numeric(5,2) at the DB and arrive as JS doubles.
    expect(resolveSpecialRate(15.0, 15)).toBeNull();
    expect(resolveSpecialRate(15, 15.0)).toBeNull();
    expect(resolveSpecialRate(15.004, 15)).toBeNull();
  });

  it('stays silent when the org default is unknown', () => {
    // Can't prove the rate is unusual without a baseline, so say nothing
    // rather than risk labelling a standard job as special.
    expect(resolveSpecialRate(20, null)).toBeNull();
    expect(resolveSpecialRate(20, undefined)).toBeNull();
  });

  it('ignores non-finite values on either side', () => {
    expect(resolveSpecialRate(NaN, 15)).toBeNull();
    expect(resolveSpecialRate(Infinity, 15)).toBeNull();
    expect(resolveSpecialRate(20, NaN)).toBeNull();
  });

  it('does not treat a zero-percent rate as absent', () => {
    // 0 is falsy — a truthiness check here would wrongly hide a 0% job.
    expect(resolveSpecialRate(0, 15)).toBe(0);
  });
});

describe('formatRatePct', () => {
  it('strips trailing zeros so it reads like a human wrote it', () => {
    expect(formatRatePct(20)).toBe('20%');
    expect(formatRatePct(15.0)).toBe('15%');
  });

  it('keeps meaningful decimals', () => {
    expect(formatRatePct(12.5)).toBe('12.5%');
    expect(formatRatePct(7.25)).toBe('7.25%');
  });

  it('formats zero without mangling it', () => {
    expect(formatRatePct(0)).toBe('0%');
  });
});
