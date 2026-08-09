import {
  periodRange, periodCount, periodKeysDesc, periodHeadline, emptyStateText,
  monthPeriod, weekPeriod, modeOf, keyOf, MAX_PERIODS,
  type EarningsPeriod,
} from '../earningsPeriod';

// These decide which jobs count toward the number a driver checks their pay
// against, so the boundaries are the test, not an implementation detail.
//
// Malaysia is UTC+8, so the start of a MY day is 16:00 UTC the day before.
// Every expectation below is written in UTC on purpose — if these ever read
// "2026-07-01T00:00:00Z" someone has quietly reintroduced the device-local
// boundary bug this module exists to prevent.

// A fixed "now" so relative expectations can't drift with the wall clock.
// 2026-08-09 06:00 UTC = 14:00 MY, a SUNDAY. Deliberately a Sunday: it is the
// day a Monday-start week is most likely to be computed wrong.
const NOW = new Date('2026-08-09T06:00:00.000Z');

describe('modeOf / keyOf', () => {
  it('separates the two keyed period kinds', () => {
    expect(modeOf(monthPeriod('2026-07'))).toBe('month');
    expect(modeOf(weekPeriod('2026-08-03'))).toBe('week');
    expect(modeOf('all')).toBe('all');
  });

  it('round-trips the key', () => {
    expect(keyOf(monthPeriod('2026-07'))).toBe('2026-07');
    expect(keyOf(weekPeriod('2026-08-03'))).toBe('2026-08-03');
    expect(keyOf('all')).toBeNull();
  });
});

describe('periodRange — months', () => {
  it('covers exactly that MY month, half-open', () => {
    expect(periodRange(monthPeriod('2026-07'), NOW)).toEqual({
      since: '2026-06-30T16:00:00.000Z',
      until: '2026-07-31T16:00:00.000Z',
    });
  });

  it("hands one month's end to the next month's start, with no gap or overlap", () => {
    expect(periodRange(monthPeriod('2026-07'), NOW).until)
      .toBe(periodRange(monthPeriod('2026-08'), NOW).since);
  });

  it('bounds the CURRENT month too, in the future', () => {
    // Every period is built the same way. The bound sits ahead of now so it can
    // never exclude a real job — but it means no period is a special
    // open-ended case that a past one then has to remember to close, which is
    // the bug that returns "July and everything after it" under July's heading.
    const { until } = periodRange(monthPeriod('2026-08'), NOW);
    expect(until).toBe('2026-08-31T16:00:00.000Z');
    expect(new Date(until!).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('rolls the year over December', () => {
    expect(periodRange(monthPeriod('2025-12'), NOW)).toEqual({
      since: '2025-11-30T16:00:00.000Z',
      until: '2025-12-31T16:00:00.000Z',
    });
  });

  it('handles February in a leap year', () => {
    expect(periodRange(monthPeriod('2028-02'), NOW).until).toBe('2028-02-29T16:00:00.000Z');
  });
});

describe('periodRange — weeks', () => {
  it('covers exactly seven MY days from a Monday', () => {
    // 3 Aug 2026 is a Monday. 00:00 MY on it is 2 Aug 16:00 UTC.
    expect(periodRange(weekPeriod('2026-08-03'), NOW)).toEqual({
      since: '2026-08-02T16:00:00.000Z',
      until: '2026-08-09T16:00:00.000Z',
    });
  });

  it('abuts the neighbouring weeks exactly', () => {
    // Overlapping weeks would double-count a job across two pages, which is the
    // reason "this week" stopped being a rolling last-7-days.
    expect(periodRange(weekPeriod('2026-07-27'), NOW).until)
      .toBe(periodRange(weekPeriod('2026-08-03'), NOW).since);
  });

  it('crosses a month boundary without breaking', () => {
    expect(periodRange(weekPeriod('2026-07-27'), NOW)).toEqual({
      since: '2026-07-26T16:00:00.000Z',
      until: '2026-08-02T16:00:00.000Z',
    });
  });
});

describe('periodRange — all time and malformed keys', () => {
  it('leaves All Time unbounded at both ends', () => {
    expect(periodRange('all', NOW)).toEqual({ since: null, until: null });
  });

  // Throwing is deliberate. Falling back to "all time" would show a driver
  // every job they have ever done under a heading naming one period, and an
  // empty range would show RM 0 — both are plausible-looking wrong answers to
  // a question about pay, which is worse than an error.
  it.each([
    ['m:not-a-month'], ['m:2026-13'], ['m:2026-00'], ['m:2026'], ['m:'],
    ['w:2026-08'], ['w:not-a-date'], ['w:2026-13-01'], ['w:'],
  ])('throws on %s rather than guessing a range', (p) => {
    expect(() => periodRange(p as EarningsPeriod, NOW)).toThrow(/Unparseable earnings period/);
  });
});

describe('periodCount — bounded by real history, ceiling of 3', () => {
  it('offers one page per month of history, up to the ceiling', () => {
    expect(periodCount('month', '2026-08-01T02:00:00Z', NOW)).toBe(1); // this month only
    expect(periodCount('month', '2026-07-15T02:00:00Z', NOW)).toBe(2);
    expect(periodCount('month', '2026-06-15T02:00:00Z', NOW)).toBe(3);
  });

  it('never exceeds the ceiling however long the history', () => {
    // The ceiling is the product decision — three pages, not a year of them.
    expect(periodCount('month', '2020-01-01T02:00:00Z', NOW)).toBe(MAX_PERIODS);
    expect(periodCount('week', '2020-01-01T02:00:00Z', NOW)).toBe(MAX_PERIODS);
    expect(MAX_PERIODS).toBe(3);
  });

  it('never pads up to the ceiling', () => {
    // A page the driver cannot have worked is a dot that promises data and
    // delivers an empty state. A pager that lies about its length is worse
    // than a short one.
    expect(periodCount('month', '2026-08-05T02:00:00Z', NOW)).toBe(1);
    expect(periodCount('week', '2026-08-05T02:00:00Z', NOW)).toBe(1);
  });

  it('counts weeks as Monday-anchored buckets, not 7-day spans', () => {
    // 9 Aug 2026 is a Sunday, so its week began Mon 3 Aug. A job on Sun 2 Aug
    // is in the PREVIOUS week even though it is only 7 days back.
    expect(periodCount('week', '2026-08-03T02:00:00Z', NOW)).toBe(1);
    expect(periodCount('week', '2026-08-02T02:00:00Z', NOW)).toBe(2);
  });

  it('gives one page to a driver with no completed jobs', () => {
    expect(periodCount('month', null, NOW)).toBe(1);
    expect(periodCount('week', undefined, NOW)).toBe(1);
  });

  it('always reports one page for All Time', () => {
    expect(periodCount('all', '2020-01-01T02:00:00Z', NOW)).toBe(1);
    expect(periodCount('all', null, NOW)).toBe(1);
  });
});

describe('periodKeysDesc', () => {
  it('lists months newest first, index 0 being the current one', () => {
    // The index doubles as "how many periods back am I", which is what the
    // pager and its dots track — so the order is load-bearing, not cosmetic.
    expect(periodKeysDesc('month', 3, NOW)).toEqual(['m:2026-08', 'm:2026-07', 'm:2026-06']);
  });

  it('lists weeks newest first, anchored on Mondays', () => {
    expect(periodKeysDesc('week', 3, NOW)).toEqual(['w:2026-08-03', 'w:2026-07-27', 'w:2026-07-20']);
  });

  it('rolls the year backwards over January', () => {
    const jan = new Date('2026-01-10T06:00:00.000Z');
    expect(periodKeysDesc('month', 3, jan)).toEqual(['m:2026-01', 'm:2025-12', 'm:2025-11']);
  });

  it('returns a single all-time period regardless of count', () => {
    expect(periodKeysDesc('all', 3, NOW)).toEqual(['all']);
  });

  it('handles a zero or negative count without looping forever', () => {
    expect(periodKeysDesc('month', 0, NOW)).toEqual([]);
    expect(periodKeysDesc('month', -2, NOW)).toEqual([]);
  });

  it('produces keys periodRange can parse', () => {
    // The two halves must agree: periodRange throws on a malformed key, and
    // these are the only keys the UI ever hands it.
    for (const p of [...periodKeysDesc('month', 3, NOW), ...periodKeysDesc('week', 3, NOW)]) {
      expect(() => periodRange(p, NOW)).not.toThrow();
    }
  });
});

describe('periodHeadline', () => {
  it('names the current period relatively', () => {
    // "This month" is how a driver refers to it out loud.
    expect(periodHeadline(monthPeriod('2026-08'), NOW)).toBe('This month');
    expect(periodHeadline(weekPeriod('2026-08-03'), NOW)).toBe('This week');
  });

  it('names last week relatively, but earlier weeks by their dates', () => {
    // "2 weeks ago" forces arithmetic on the person least able to check it;
    // dates are what a payslip is checked against.
    expect(periodHeadline(weekPeriod('2026-07-27'), NOW)).toBe('Last week');
    expect(periodHeadline(weekPeriod('2026-07-20'), NOW)).toBe('20 Jul – 26 Jul');
  });

  it('names past months absolutely, with the year', () => {
    expect(periodHeadline(monthPeriod('2026-07'), NOW)).toBe('July 2026');
    expect(periodHeadline(monthPeriod('2025-12'), NOW)).toBe('December 2025');
  });

  it('labels all time', () => {
    expect(periodHeadline('all', NOW)).toBe('All time');
  });
});

describe('emptyStateText', () => {
  it('reads as a sentence for relative periods', () => {
    expect(emptyStateText(monthPeriod('2026-08'), NOW)).toBe('No completed jobs this month.');
    expect(emptyStateText(weekPeriod('2026-07-27'), NOW)).toBe('No completed jobs last week.');
  });

  it('keeps a month name capitalised', () => {
    // Built per period rather than by lowercasing the headline, which turned
    // month names into "july 2026".
    expect(emptyStateText(monthPeriod('2026-07'), NOW)).toBe('No completed jobs in July 2026.');
  });

  it('handles all time', () => {
    expect(emptyStateText('all', NOW)).toBe('No completed jobs yet.');
  });
});
