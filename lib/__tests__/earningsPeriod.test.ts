import { periodRange, monthPeriod, monthKeyOf, type EarningsPeriod } from '../earningsPeriod';

// These decide which jobs count toward the number a driver checks their pay
// against, so the boundaries are the test, not an implementation detail.
//
// Malaysia is UTC+8, so the start of a MY month is 16:00 UTC on the last day of
// the PREVIOUS month. Every expectation below is written in UTC on purpose — if
// these ever read "2026-07-01T00:00:00Z" someone has quietly reintroduced the
// device-local boundary bug this module exists to prevent.

// A fixed "now" so week/month expectations can't drift with the wall clock.
// Built from an explicit UTC instant: 2026-08-09 06:00 UTC = 14:00 MY.
const NOW = new Date('2026-08-09T06:00:00.000Z');

describe('monthPeriod / monthKeyOf', () => {
  it('round-trips a month key', () => {
    expect(monthKeyOf(monthPeriod('2026-07'))).toBe('2026-07');
  });

  it('returns null for the three fixed periods', () => {
    expect(monthKeyOf('week')).toBeNull();
    expect(monthKeyOf('all')).toBeNull();
  });

  it('does not mistake "month" for a month key', () => {
    // 'month' and 'm:2026-07' share a first letter, and a `startsWith('m')`
    // check would read "this month" as the month named "onth".
    expect(monthKeyOf('month')).toBeNull();
  });
});

describe('periodRange — the three original periods', () => {
  it('leaves All Time unbounded at both ends', () => {
    expect(periodRange('all', NOW)).toEqual({ since: null, until: null });
  });

  it('starts This Week at MY midnight six days back, inclusive', () => {
    // 6 days back from 9 Aug MY is 3 Aug MY, which begins 2 Aug 16:00 UTC.
    expect(periodRange('week', NOW).since).toBe('2026-08-02T16:00:00.000Z');
  });

  it('starts This Month at the MY month boundary, not the UTC one', () => {
    // 1 Aug 00:00 MY = 31 Jul 16:00 UTC. A UTC boundary here would pull in the
    // last eight hours of 31 July as if they were August.
    expect(periodRange('month', NOW).since).toBe('2026-07-31T16:00:00.000Z');
  });

  it('leaves the running periods open-ended', () => {
    // They run to "now", so an upper bound would only be a way to be wrong.
    expect(periodRange('week', NOW).until).toBeNull();
    expect(periodRange('month', NOW).until).toBeNull();
  });
});

describe('periodRange — a named past month', () => {
  it('covers exactly that MY month, half-open', () => {
    // The whole feature in one assertion: July starts when July starts in
    // Malaysia and ends when August does, so no job is counted twice or lost.
    expect(periodRange(monthPeriod('2026-07'), NOW)).toEqual({
      since: '2026-06-30T16:00:00.000Z',
      until: '2026-07-31T16:00:00.000Z',
    });
  });

  it('bounds the range at BOTH ends', () => {
    // The bug this guards: the query had no upper bound, because every period
    // before this one ran to "now". Without `until`, picking July returns July
    // AND everything after it, under a heading that says July.
    const { until } = periodRange(monthPeriod('2026-07'), NOW);
    expect(until).not.toBeNull();
  });

  it("hands one month's end to the next month's start, with no gap or overlap", () => {
    const july = periodRange(monthPeriod('2026-07'), NOW);
    const august = periodRange(monthPeriod('2026-08'), NOW);
    expect(july.until).toBe(august.since);
  });

  it('rolls the year over December', () => {
    // Date.UTC(y, 12, 1) must become January of y+1, not month 12 of y.
    expect(periodRange(monthPeriod('2025-12'), NOW)).toEqual({
      since: '2025-11-30T16:00:00.000Z',
      until: '2025-12-31T16:00:00.000Z',
    });
  });

  it('handles a February in a leap year', () => {
    expect(periodRange(monthPeriod('2028-02'), NOW)).toEqual({
      since: '2028-01-31T16:00:00.000Z',
      until: '2028-02-29T16:00:00.000Z',
    });
  });

  it('does not depend on "now"', () => {
    // A named month is an absolute range. If it moved with the clock, a driver
    // reopening July next year would see a different July.
    const a = periodRange(monthPeriod('2026-07'), NOW);
    const b = periodRange(monthPeriod('2026-07'), new Date('2027-03-03T22:00:00.000Z'));
    expect(a).toEqual(b);
  });
});

describe('periodRange — malformed month keys', () => {
  // Throwing is deliberate. Falling back to "all time" would show a driver
  // every job they have ever done under a heading naming one month, and an
  // empty range would show RM 0 — both are plausible-looking wrong answers to
  // a question about pay, which is worse than an error.
  it.each([
    ['m:not-a-month'],
    ['m:2026-13'],
    ['m:2026-00'],
    ['m:2026'],
    ['m:'],
  ])('throws on %s rather than guessing a range', (p) => {
    expect(() => periodRange(p as EarningsPeriod, NOW)).toThrow(/Unparseable earnings month period/);
  });
});
