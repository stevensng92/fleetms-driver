import {
  resolveSpecialCommission,
  resolveEffectiveCommission,
  resolveDriverBaseline,
  normalizeOrgRate,
  formatRatePct,
  formatFixedFee,
  formatSpecialCommission,
  type CommissionBasis,
} from '../commissionRate';

// Two rules, deliberately different, and both easy to "simplify" wrongly.
//
// PERCENTAGE: "has an override" is NOT "pays a different rate". On production,
// 9 of 16 overridden jobs are pinned to exactly the default, so a null-check
// instead of a value comparison would wrongly badge more than half of them.
// The value compared against is the DRIVER's normal rate, never the org's.
//
// FIXED: a flat fee is never a percentage, so there is nothing to compare and a
// fee ALWAYS surfaces — including with no baseline known, including on a job
// with no fare, and including when the fee IS the driver's own normal pay.
// Making this branch symmetrical with the percentage branch would re-open the
// bug the fixed mode exists to close: a RM 80 fee on a RM 500 job rendering as
// if the org's ~20% applied (~RM 100).

// Baselines read better as what they are than as object literals inline.
const rate = (pct: number): CommissionBasis => ({ kind: 'rate', pct });
const fee  = (amount: number): CommissionBasis => ({ kind: 'fixed', amount });

const ORG_15 = rate(15);

describe('resolveDriverBaseline — the driver rungs (3, 4, 5)', () => {
  it('prefers the driver fee over everything below it', () => {
    // Rung 3. "This freelancer always gets RM 120 a run."
    expect(resolveDriverBaseline(120, 75, 15)).toEqual({ kind: 'fixed', amount: 120 });
    expect(resolveDriverBaseline(120, null, 15)).toEqual({ kind: 'fixed', amount: 120 });
  });

  it('prefers the driver rate over the org rate', () => {
    // Rung 4 above rung 5 — the whole point of a per-driver split existing.
    expect(resolveDriverBaseline(null, 75, 15)).toEqual({ kind: 'rate', pct: 75 });
  });

  it('falls back to the org rate when the driver has neither', () => {
    // Rung 5, and the overwhelmingly common case: an employee on the org default.
    expect(resolveDriverBaseline(null, null, 15)).toEqual({ kind: 'rate', pct: 15 });
    expect(resolveDriverBaseline(undefined, undefined, 15)).toEqual({ kind: 'rate', pct: 15 });
  });

  it('returns null when no rung answers', () => {
    // Honest "we don't know what normal is for this driver" — NOT a 0% baseline.
    expect(resolveDriverBaseline(null, null, null)).toBeNull();
    expect(resolveDriverBaseline(undefined, undefined, undefined)).toBeNull();
  });

  it('keeps a genuinely-zero driver fee', () => {
    // 0 is falsy; a truthiness check would drop straight through to the org
    // rate and tell a driver they earn 15% of a job that pays them nothing.
    expect(resolveDriverBaseline(0, null, 15)).toEqual({ kind: 'fixed', amount: 0 });
  });

  it('keeps an explicit 0% driver rate, unlike a 0 org rate', () => {
    // drivers.commission_rate is NULLABLE — NULL is how "unset" is spelled, so a
    // stored 0 is a decision someone made and must not fall through to rung 5.
    // organizations.driver_commission_rate is NOT NULL DEFAULT 0 and cannot tell
    // those apart, so it treats 0 as unset. Same number, opposite handling, and
    // the asymmetry is the columns' fault rather than an oversight.
    expect(resolveDriverBaseline(null, 0, 15)).toEqual({ kind: 'rate', pct: 0 });
    expect(resolveDriverBaseline(null, null, 0)).toBeNull();
  });

  it('falls through a broken driver fee rather than rendering it', () => {
    // commission_fixed_amount >= 0 is a DB CHECK, so a negative means the READ
    // is wrong, not the price. Let a lower rung answer.
    expect(resolveDriverBaseline(-120, null, 15)).toEqual({ kind: 'rate', pct: 15 });
    expect(resolveDriverBaseline(NaN, null, 15)).toEqual({ kind: 'rate', pct: 15 });
    expect(resolveDriverBaseline(Infinity, 75, 15)).toEqual({ kind: 'rate', pct: 75 });
  });

  it('falls through a broken driver rate rather than rendering it', () => {
    expect(resolveDriverBaseline(null, -75, 15)).toEqual({ kind: 'rate', pct: 15 });
    expect(resolveDriverBaseline(null, NaN, 15)).toEqual({ kind: 'rate', pct: 15 });
    expect(resolveDriverBaseline(null, Infinity, 15)).toEqual({ kind: 'rate', pct: 15 });
  });

  it('re-normalises the org rate rather than trusting the caller', () => {
    // Three read paths feed this; one of them forgetting normalizeOrgRate must
    // not be able to reintroduce the phantom-0% baseline.
    expect(resolveDriverBaseline(null, null, 0)).toBeNull();
    expect(resolveDriverBaseline(null, null, -5)).toBeNull();
    expect(resolveDriverBaseline(null, null, 'abc')).toBeNull();
    expect(resolveDriverBaseline(null, null, '15.00')).toEqual({ kind: 'rate', pct: 15 });
  });
});

describe('resolveEffectiveCommission — what the job actually pays', () => {
  it('takes the job fee first (rung 1)', () => {
    expect(resolveEffectiveCommission(80, null, ORG_15)).toEqual({ kind: 'fixed', amount: 80 });
  });

  it('takes the job rate second (rung 2)', () => {
    expect(resolveEffectiveCommission(null, 20, ORG_15)).toEqual({ kind: 'rate', pct: 20 });
  });

  it('puts a per-job RATE above a per-driver FEE', () => {
    // fleetms docs/driver-payouts.md: precedence is by level first and mode
    // second, so rung 2 beats rung 3. Reading it as "fixed always wins" would
    // pay a freelancer their standing RM 120 on a job explicitly priced at 20%.
    expect(resolveEffectiveCommission(null, 20, fee(120))).toEqual({ kind: 'rate', pct: 20 });
  });

  it('falls back to the baseline when the job prices nothing', () => {
    expect(resolveEffectiveCommission(null, null, fee(120))).toEqual({ kind: 'fixed', amount: 120 });
    expect(resolveEffectiveCommission(null, null, ORG_15)).toEqual({ kind: 'rate', pct: 15 });
  });

  it('returns null when neither the job nor the baseline knows', () => {
    expect(resolveEffectiveCommission(null, null, null)).toBeNull();
    expect(resolveEffectiveCommission(null, null, undefined)).toBeNull();
  });
});

describe('resolveSpecialCommission — fixed fee (ladder rung 1)', () => {
  it('surfaces a flat fee as its own mode, not a percentage', () => {
    // The whole point of the discriminated union: 80 here means RM 80, and
    // must be impossible to render or multiply as 80%.
    expect(resolveSpecialCommission(80, null, ORG_15)).toEqual({ kind: 'fixed', amount: 80 });
  });

  it('surfaces a fee even when the baseline is unknown', () => {
    // Mirrors the dispatcher's decision D1 — a fee is owed whatever else is or
    // isn't known. The percentage branch takes the opposite posture (below),
    // and collapsing the two into one guard is the likely wrong "cleanup".
    expect(resolveSpecialCommission(80, null, null)).toEqual({ kind: 'fixed', amount: 80 });
    expect(resolveSpecialCommission(80, null, undefined)).toEqual({ kind: 'fixed', amount: 80 });
  });

  it('surfaces a fee that happens to equal the baseline rate number', () => {
    // RM 15 and 15% are not the same fact. The value-comparison rule belongs to
    // the percentage branch only; applying it here would silently hide a fee.
    expect(resolveSpecialCommission(15, null, ORG_15)).toEqual({ kind: 'fixed', amount: 15 });
  });

  it('beats a rate override if both somehow arrive', () => {
    // The DB XOR CHECK makes this unreachable, so this pins the LADDER order
    // rather than a live case: rung 1 is above rung 2, and if the constraint
    // were ever relaxed the fee must still win.
    expect(resolveSpecialCommission(80, 20, ORG_15)).toEqual({ kind: 'fixed', amount: 80 });
  });

  it('does not treat a zero fee as absent', () => {
    // 0 is falsy — a truthiness check would hide a job whose whole take-home
    // is RM 0, which is exactly the job a driver most needs to see.
    expect(resolveSpecialCommission(0, null, ORG_15)).toEqual({ kind: 'fixed', amount: 0 });
  });

  it('keeps sen on a fee', () => {
    expect(resolveSpecialCommission(82.5, null, ORG_15)).toEqual({ kind: 'fixed', amount: 82.5 });
  });

  it('falls through on a negative fee rather than rendering it', () => {
    // commission_fixed_amount >= 0 is a DB CHECK, so a negative means the read
    // is wrong, not the price. Falling through lets the rate branch answer.
    expect(resolveSpecialCommission(-80, null, ORG_15)).toBeNull();
    expect(resolveSpecialCommission(-80, 20, ORG_15)).toEqual({ kind: 'rate', pct: 20 });
  });

  it('falls through on a non-finite fee', () => {
    expect(resolveSpecialCommission(NaN, null, ORG_15)).toBeNull();
    expect(resolveSpecialCommission(Infinity, null, ORG_15)).toBeNull();
  });
});

describe('resolveSpecialCommission — rate override (ladder rung 2)', () => {
  it('returns the rate when it genuinely differs from the baseline', () => {
    expect(resolveSpecialCommission(null, 20, ORG_15)).toEqual({ kind: 'rate', pct: 20 });
    expect(resolveSpecialCommission(null, 7.5, ORG_15)).toEqual({ kind: 'rate', pct: 7.5 });
  });

  it('returns null when there is no pricing on the job at all', () => {
    expect(resolveSpecialCommission(null, null, ORG_15)).toBeNull();
    expect(resolveSpecialCommission(undefined, undefined, ORG_15)).toBeNull();
  });

  it('returns null when the override is pinned to the baseline', () => {
    // The prod-majority case: a dispatcher set the rate explicitly, to the
    // value it already was. Not special, must not badge.
    expect(resolveSpecialCommission(null, 15, ORG_15)).toBeNull();
  });

  it('treats 15 and 15.00 as equal', () => {
    // Both sides are numeric(5,2) at the DB and arrive as JS doubles.
    expect(resolveSpecialCommission(null, 15.0, ORG_15)).toBeNull();
    expect(resolveSpecialCommission(null, 15, rate(15.0))).toBeNull();
    expect(resolveSpecialCommission(null, 15.004, ORG_15)).toBeNull();
  });

  it('stays silent when the baseline is unknown', () => {
    // Can't prove the rate is unusual without a baseline, so say nothing rather
    // than risk labelling a standard job as special. Contrast the fixed branch,
    // which surfaces regardless.
    expect(resolveSpecialCommission(null, 20, null)).toBeNull();
    expect(resolveSpecialCommission(null, 20, undefined)).toBeNull();
  });

  it('stays silent when nothing anywhere prices the job', () => {
    // Reachable on a tenant still sitting at the org default of 0 whose driver
    // has neither rung set: no job pricing, no baseline, nothing true to say.
    // The badge is the only thing suppressed — the job itself still renders.
    expect(resolveSpecialCommission(null, null, null)).toBeNull();
    expect(resolveSpecialCommission(undefined, undefined, undefined)).toBeNull();
  });

  it('ignores non-finite and negative rates', () => {
    expect(resolveSpecialCommission(null, NaN, ORG_15)).toBeNull();
    expect(resolveSpecialCommission(null, Infinity, ORG_15)).toBeNull();
    // 0–100 is a DB CHECK, so a negative override is a broken read, not a price.
    expect(resolveSpecialCommission(null, -20, ORG_15)).toBeNull();
  });

  it('does not treat a zero-percent rate as absent', () => {
    // 0 is falsy — a truthiness check here would wrongly hide a 0% job.
    expect(resolveSpecialCommission(null, 0, ORG_15)).toEqual({ kind: 'rate', pct: 0 });
  });
});

describe('resolveSpecialCommission — measured against the DRIVER, not the org', () => {
  // The two bugs this pairing exists to prevent. Both are silent in opposite
  // directions, and both were live before the driver rungs were read at all.

  it('does not badge a freelancer whose job is pinned to their own rate', () => {
    // Bug (a): a driver on a 75% split, on a job explicitly pinned to 75%, is
    // being paid completely normally. Compared against the ORG's 15% every one
    // of their jobs wore "different from your usual rate" — their usual rate
    // being, precisely, the thing they were pinned to.
    expect(resolveSpecialCommission(null, 75, rate(75))).toBeNull();
    // ...and the org rate is now irrelevant to that job, which is the point.
    expect(resolveSpecialCommission(null, 75, ORG_15)).toEqual({ kind: 'rate', pct: 75 });
  });

  it('surfaces a freelancer\'s standing fee on a job that prices nothing', () => {
    // Bug (b): the app read "no job-level override" as "pays the standard org
    // rate", so a driver whose personal default is RM 120 a run saw NOTHING —
    // and the fare card beside it still invited them to take the org's ~20%.
    // This is the same silence one rung up that the fixed mode was built to fix.
    expect(resolveSpecialCommission(null, null, fee(120))).toEqual({ kind: 'fixed', amount: 120 });
  });

  it('badges a rate job for a driver who is normally paid a fee', () => {
    // Different modes is a real difference, whatever the numbers are — and it
    // is the one case where the RM 120 this driver expects does NOT apply.
    // Silence here would be read as "the usual RM 120".
    expect(resolveSpecialCommission(null, 20, fee(120))).toEqual({ kind: 'rate', pct: 20 });
    // Even a 0% job, which is the most expensive possible version of this
    // mistake for the driver.
    expect(resolveSpecialCommission(null, 0, fee(120))).toEqual({ kind: 'rate', pct: 0 });
  });

  it('still surfaces a job fee that matches the driver fee exactly', () => {
    // No "explicit-but-standard" exemption on this branch, unlike the pinned-
    // rate case above: what is being disclosed is the MODE, and a flat fee is
    // unusual against the fare every single time it renders. Hiding it because
    // it equals the driver's default would reproduce bug (b) on the jobs a
    // dispatcher priced by hand.
    expect(resolveSpecialCommission(120, null, fee(120))).toEqual({ kind: 'fixed', amount: 120 });
  });

  it('compares against the driver rate even when an org rate also exists', () => {
    // Both rungs populated: rung 4 must win, or the comparison silently uses a
    // baseline the driver is not actually paid on.
    const baseline = resolveDriverBaseline(null, 75, 15);
    expect(resolveSpecialCommission(null, 75, baseline)).toBeNull();
    expect(resolveSpecialCommission(null, 15, baseline)).toEqual({ kind: 'rate', pct: 15 });
  });

  it('ends-to-end: a fee-default freelancer sees the fee on every job', () => {
    // The realistic board for a driver on RM 120 a run: most jobs price
    // nothing, one is pinned to the same fee, one is overridden to a rate.
    const baseline = resolveDriverBaseline(120, null, 15);
    expect(resolveSpecialCommission(null, null, baseline)).toEqual({ kind: 'fixed', amount: 120 });
    expect(resolveSpecialCommission(150, null, baseline)).toEqual({ kind: 'fixed', amount: 150 });
    expect(resolveSpecialCommission(null, 30, baseline)).toEqual({ kind: 'rate', pct: 30 });
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
    const baseline = resolveDriverBaseline(null, null, 0);
    expect(baseline).toBeNull();
    expect(resolveSpecialCommission(null, 20, baseline)).toBeNull();
    expect(resolveSpecialCommission(80, null, baseline)).toEqual({ kind: 'fixed', amount: 80 });
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
