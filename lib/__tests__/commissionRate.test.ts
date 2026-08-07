import {
  resolveSpecialCommission,
  normalizeOrgRate,
  formatRatePct,
  formatFixedFee,
  formatSpecialCommission,
} from '../commissionRate';

// Two rules, deliberately different, and both easy to "simplify" wrongly.
//
// PERCENTAGE: "has an override" is NOT "pays a different rate". On production,
// 9 of 16 overridden jobs are pinned to exactly the org default, so a null-check
// instead of a value comparison would wrongly badge more than half of them.
//
// FIXED: a flat fee is never the org's percentage, so there is nothing to
// compare and a fee ALWAYS surfaces — including with no org rate known, and
// including on a job with no fare. Making this branch symmetrical with the
// percentage branch would re-open the bug the fixed mode exists to close: a
// RM 80 fee on a RM 500 job rendering as if the org's ~20% applied (~RM 100).

describe('resolveSpecialCommission — fixed fee (ladder rung 1)', () => {
  it('surfaces a flat fee as its own mode, not a percentage', () => {
    // The whole point of the discriminated union: 80 here means RM 80, and
    // must be impossible to render or multiply as 80%.
    expect(resolveSpecialCommission(80, null, 15)).toEqual({ kind: 'fixed', amount: 80 });
  });

  it('surfaces a fee even when the org default rate is unknown', () => {
    // Mirrors the dispatcher's decision D1 — a fee is owed whatever else is or
    // isn't known. The percentage branch takes the opposite posture (below),
    // and collapsing the two into one guard is the likely wrong "cleanup".
    expect(resolveSpecialCommission(80, null, null)).toEqual({ kind: 'fixed', amount: 80 });
    expect(resolveSpecialCommission(80, null, undefined)).toEqual({ kind: 'fixed', amount: 80 });
  });

  it('surfaces a fee that happens to equal the org rate number', () => {
    // RM 15 and 15% are not the same fact. The value-comparison rule belongs to
    // the percentage branch only; applying it here would silently hide a fee.
    expect(resolveSpecialCommission(15, null, 15)).toEqual({ kind: 'fixed', amount: 15 });
  });

  it('beats a rate override if both somehow arrive', () => {
    // The DB XOR CHECK makes this unreachable, so this pins the LADDER order
    // rather than a live case: rung 1 is above rung 2, and if the constraint
    // were ever relaxed the fee must still win.
    expect(resolveSpecialCommission(80, 20, 15)).toEqual({ kind: 'fixed', amount: 80 });
  });

  it('does not treat a zero fee as absent', () => {
    // 0 is falsy — a truthiness check would hide a job whose whole take-home
    // is RM 0, which is exactly the job a driver most needs to see.
    expect(resolveSpecialCommission(0, null, 15)).toEqual({ kind: 'fixed', amount: 0 });
  });

  it('keeps sen on a fee', () => {
    expect(resolveSpecialCommission(82.5, null, 15)).toEqual({ kind: 'fixed', amount: 82.5 });
  });

  it('falls through on a negative fee rather than rendering it', () => {
    // commission_fixed_amount >= 0 is a DB CHECK, so a negative means the read
    // is wrong, not the price. Falling through lets the rate branch answer.
    expect(resolveSpecialCommission(-80, null, 15)).toBeNull();
    expect(resolveSpecialCommission(-80, 20, 15)).toEqual({ kind: 'rate', pct: 20 });
  });

  it('falls through on a non-finite fee', () => {
    expect(resolveSpecialCommission(NaN, null, 15)).toBeNull();
    expect(resolveSpecialCommission(Infinity, null, 15)).toBeNull();
  });
});

describe('resolveSpecialCommission — rate override (ladder rung 2)', () => {
  it('returns the rate when it genuinely differs from the org default', () => {
    expect(resolveSpecialCommission(null, 20, 15)).toEqual({ kind: 'rate', pct: 20 });
    expect(resolveSpecialCommission(null, 7.5, 15)).toEqual({ kind: 'rate', pct: 7.5 });
  });

  it('returns null when there is no pricing on the job at all', () => {
    expect(resolveSpecialCommission(null, null, 15)).toBeNull();
    expect(resolveSpecialCommission(undefined, undefined, 15)).toBeNull();
  });

  it('returns null when the override is pinned to the org default', () => {
    // The prod-majority case: a dispatcher set the rate explicitly, to the
    // value it already was. Not special, must not badge.
    expect(resolveSpecialCommission(null, 15, 15)).toBeNull();
  });

  it('treats 15 and 15.00 as equal', () => {
    // Both sides are numeric(5,2) at the DB and arrive as JS doubles.
    expect(resolveSpecialCommission(null, 15.0, 15)).toBeNull();
    expect(resolveSpecialCommission(null, 15, 15.0)).toBeNull();
    expect(resolveSpecialCommission(null, 15.004, 15)).toBeNull();
  });

  it('stays silent when the org default is unknown', () => {
    // Can't prove the rate is unusual without a baseline, so say nothing rather
    // than risk labelling a standard job as special. Contrast the fixed branch,
    // which surfaces regardless.
    expect(resolveSpecialCommission(null, 20, null)).toBeNull();
    expect(resolveSpecialCommission(null, 20, undefined)).toBeNull();
  });

  it('ignores non-finite values on either side', () => {
    expect(resolveSpecialCommission(null, NaN, 15)).toBeNull();
    expect(resolveSpecialCommission(null, Infinity, 15)).toBeNull();
    expect(resolveSpecialCommission(null, 20, NaN)).toBeNull();
  });

  it('does not treat a zero-percent rate as absent', () => {
    // 0 is falsy — a truthiness check here would wrongly hide a 0% job.
    expect(resolveSpecialCommission(null, 0, 15)).toEqual({ kind: 'rate', pct: 0 });
  });
});

describe('normalizeOrgRate', () => {
  // This guard was inlined in ONE of the three read paths and missing from the
  // other two, so on a tenant sitting at the NOT NULL DEFAULT 0 the same job
  // badged on Earnings and not on the Jobs list. Sharing it is the fix; these
  // tests are what keep it shared.

  it('passes a real rate through', () => {
    expect(normalizeOrgRate(15)).toBe(15);
    expect(normalizeOrgRate('15.00')).toBe(15);
  });

  it('rejects an absent rate rather than reading it as 0%', () => {
    // Number(null) is 0, not NaN, and Number.isFinite(0) is true — so a bare
    // Number() would hand back a legitimate-looking 0% baseline and badge every
    // overridden job as "different from your usual rate".
    expect(normalizeOrgRate(null)).toBeNull();
    expect(normalizeOrgRate(undefined)).toBeNull();
  });

  it('rejects a 0 rate, because the column is NOT NULL DEFAULT 0', () => {
    // A newly-onboarded tenant that hasn't set its rate reads 0. Treating that
    // as a genuine 0% baseline badges the whole job board on day one.
    expect(normalizeOrgRate(0)).toBeNull();
    expect(normalizeOrgRate(-5)).toBeNull();
  });

  it('rejects unparseable values', () => {
    expect(normalizeOrgRate('abc')).toBeNull();
  });

  it('leaves a fixed fee visible even when it rejects the baseline', () => {
    // The consequence that matters: a rejected baseline silences rate badges,
    // and must NOT silence fees.
    const orgRate = normalizeOrgRate(0);
    expect(resolveSpecialCommission(null, 20, orgRate)).toBeNull();
    expect(resolveSpecialCommission(80, null, orgRate)).toEqual({ kind: 'fixed', amount: 80 });
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

describe('formatFixedFee', () => {
  it('drops the cents when there are none', () => {
    // How the fee was agreed out loud, and two characters shorter in a pill
    // that shares a row with the fare and a status chip.
    expect(formatFixedFee(80)).toBe('RM 80');
    expect(formatFixedFee(120)).toBe('RM 120');
  });

  it('keeps the cents when there are any', () => {
    expect(formatFixedFee(82.5)).toBe('RM 82.50');
    expect(formatFixedFee(99.99)).toBe('RM 99.99');
  });

  it('formats a zero fee without mangling it', () => {
    expect(formatFixedFee(0)).toBe('RM 0');
  });

  it('rounds to sen rather than leaking float noise', () => {
    // numeric(12,2) at the DB, JS double in transit.
    expect(formatFixedFee(80.004)).toBe('RM 80');
    expect(formatFixedFee(80.005)).toBe('RM 80.01');
  });
});

describe('formatSpecialCommission', () => {
  it('names the mode when standing alone', () => {
    // "RM 80" with no qualifier is the ambiguous case — beside a RM 500 fare it
    // reads as a discount, a deposit, or a cut. "flat" is what makes it pay.
    expect(formatSpecialCommission({ kind: 'fixed', amount: 80 })).toBe('RM 80 flat');
    expect(formatSpecialCommission({ kind: 'rate', pct: 20 })).toBe('20% comm');
  });

  it('drops the qualifier in compact mode', () => {
    // Used inside CommissionRateCard, whose own label already names the mode.
    expect(formatSpecialCommission({ kind: 'fixed', amount: 80 }, true)).toBe('RM 80');
    expect(formatSpecialCommission({ kind: 'rate', pct: 20 }, true)).toBe('20%');
  });

  it('never renders a fee with a percent sign', () => {
    // The regression this whole change exists to prevent.
    expect(formatSpecialCommission({ kind: 'fixed', amount: 20 })).not.toContain('%');
  });
});
