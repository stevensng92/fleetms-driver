import {
  formatClock, formatDate, formatDateKey, formatDateLong, formatDateTime,
  formatDayLong, formatMonthLong,
  myDateKey, myMonthStartKey, myStartOfDay, myStartOfMonth,
} from '../timeFormat';

// The house format is 24-hour digits with the am/pm marker KEPT behind them
// ("14:30 pm"). That marker is redundant after noon and is retained on purpose
// — see the header comment in lib/timeFormat.ts. These tests pin that decision
// so a future "cleanup" that drops the suffix fails loudly instead of silently
// changing every clock in the app.

describe('formatClock', () => {
  // Build the UTC instant whose MALAYSIAN wall clock reads h:m. Malaysia is
  // UTC+8, so UTC = MY - 8. Using Date.UTC (not the local-component
  // constructor) means these assertions hold on any machine in any timezone —
  // which is the whole point now that formatClock pins the zone itself rather
  // than reading the device's.
  const at = (h: number, m: number) => new Date(Date.UTC(2026, 6, 30, h - 8, m));

  it('pads hours to two digits', () => {
    expect(formatClock(at(9, 0))).toBe('09:00 am');
    expect(formatClock(at(9, 5))).toBe('09:05 am');
  });

  it('uses 24-hour digits in the afternoon, not 12-hour', () => {
    expect(formatClock(at(14, 30))).toBe('14:30 pm');
    expect(formatClock(at(19, 45))).toBe('19:45 pm');
  });

  it('keeps the am/pm marker even though 24h digits make it redundant', () => {
    // The redundancy is the product decision. If this assertion is what broke,
    // read lib/timeFormat.ts before "fixing" it.
    expect(formatClock(at(23, 59))).toBe('23:59 pm');
    expect(formatClock(at(13, 0))).toBe('13:00 pm');
  });

  it('treats midnight as 00:xx am', () => {
    expect(formatClock(at(0, 0))).toBe('00:00 am');
    expect(formatClock(at(0, 15))).toBe('00:15 am');
  });

  it('treats noon as pm and the minute before it as am', () => {
    expect(formatClock(at(12, 0))).toBe('12:00 pm');
    expect(formatClock(at(11, 59))).toBe('11:59 am');
  });

  it('accepts an ISO string, resolved in Malaysian time', () => {
    // 06:30Z is 14:30 in Malaysia (UTC+8).
    expect(formatClock('2026-07-30T06:30:00Z')).toBe('14:30 pm');
  });

  it('ignores the device timezone entirely', () => {
    // The regression this guards: formatClock used to call getHours(), so a
    // phone with a wrong auto-timezone showed a pickup time no other FleetMS
    // surface agreed with. Same instant, three device zones, one answer.
    const instant = '2026-07-30T06:30:00Z';
    const original = process.env.TZ;
    for (const tz of ['UTC', 'America/New_York', 'Australia/Sydney', 'Asia/Kolkata']) {
      process.env.TZ = tz;
      expect(formatClock(instant)).toBe('14:30 pm');
    }
    process.env.TZ = original;
  });

  it('resolves the MY calendar day, not the UTC one', () => {
    // 17:00Z on the 30th is already 01:00 on the 31st in Malaysia. Getting this
    // wrong shifts a pickup onto the wrong day, which is worse than a wrong hour.
    expect(formatClock('2026-07-30T17:00:00Z')).toBe('01:00 am');
    expect(formatDate('2026-07-30T17:00:00Z')).toBe('31 Jul');
  });

  it('degrades to an em dash rather than rendering NaN', () => {
    expect(formatClock('not-a-date')).toBe('—');
    expect(formatClock('')).toBe('—');
  });
});

describe('formatDate', () => {
  it('renders the Malaysian calendar date', () => {
    expect(formatDate('2026-07-30T06:30:00Z')).toBe('30 Jul');
  });

  it('adds the weekday on request', () => {
    expect(formatDate('2026-07-30T06:30:00Z', { weekday: true })).toBe('Thu, 30 Jul');
  });

  it('degrades to an em dash on unparseable input', () => {
    expect(formatDate('nope')).toBe('—');
  });
});

describe('formatDateLong', () => {
  it('spells the month out with the year', () => {
    expect(formatDateLong('2026-08-01T02:00:00Z')).toBe('1 August 2026');
  });

  it('degrades to an em dash on unparseable input', () => {
    expect(formatDateLong('nope')).toBe('—');
  });
});

describe('myDateKey', () => {
  it('returns the Malaysian calendar day, not the UTC one', () => {
    // 2026-07-31T17:00Z is already 01:00 on 1 Aug in Malaysia. The old
    // toISOString().slice(0,10) returned "2026-07-31" here — a driver logging
    // fuel after a pre-dawn airport run saw 1 August on screen and filed the
    // expense against 31 July, landing it in the previous MONTH.
    expect(myDateKey('2026-07-31T17:00:00Z')).toBe('2026-08-01');
  });

  it('agrees with what the screen displays, at the boundary', () => {
    // The bug was the mismatch, so pin the pair rather than each half.
    const preDawn = '2026-07-31T17:30:00Z'; // 01:30 on 1 Aug, MY
    expect(formatDateLong(preDawn)).toBe('1 August 2026');
    expect(myDateKey(preDawn)).toBe('2026-08-01');
  });

  it('zero-pads month and day', () => {
    expect(myDateKey('2026-01-05T02:00:00Z')).toBe('2026-01-05');
  });

  it('ignores the device timezone', () => {
    const instant = '2026-07-31T17:00:00Z';
    const original = process.env.TZ;
    for (const tz of ['UTC', 'America/New_York', 'Australia/Sydney']) {
      process.env.TZ = tz;
      expect(myDateKey(instant)).toBe('2026-08-01');
    }
    process.env.TZ = original;
  });
});

describe('myMonthStartKey', () => {
  it('anchors to the first of the Malaysian month', () => {
    expect(myMonthStartKey('2026-08-14T06:00:00Z')).toBe('2026-08-01');
  });

  it('does not bleed into the previous month at the boundary', () => {
    // The regression: `new Date(2026, 7, 1).toISOString().slice(0,10)` yields
    // "2026-07-31" at UTC+8, so a "this month" expenses range started a day
    // early and swallowed the last day of July into August's total.
    expect(myMonthStartKey('2026-08-01T00:30:00Z')).toBe('2026-08-01');
    expect(myMonthStartKey('2026-07-31T17:00:00Z')).toBe('2026-08-01'); // 01:00 MY, 1 Aug
    expect(myMonthStartKey('2026-07-31T15:00:00Z')).toBe('2026-07-01'); // 23:00 MY, 31 Jul
  });

  it('rolls the year over on the December boundary', () => {
    expect(myMonthStartKey('2026-12-14T06:00:00Z', 1)).toBe('2027-01-01');
    expect(myMonthStartKey('2026-01-14T06:00:00Z', -1)).toBe('2025-12-01');
  });

  it('gives an exclusive upper bound with offset 1', () => {
    expect(myMonthStartKey('2026-08-14T06:00:00Z', 1)).toBe('2026-09-01');
  });

  it('ignores the device timezone', () => {
    const instant = '2026-07-31T17:00:00Z';
    const original = process.env.TZ;
    for (const tz of ['UTC', 'America/New_York', 'Australia/Sydney']) {
      process.env.TZ = tz;
      expect(myMonthStartKey(instant)).toBe('2026-08-01');
    }
    process.env.TZ = original;
  });
});

describe('formatDateKey', () => {
  it('formats a calendar-day string without touching Date', () => {
    expect(formatDateKey('2026-08-01')).toBe('01 Aug 2026');
    expect(formatDateKey('2026-12-31')).toBe('31 Dec 2026');
  });

  it('honours the year and long-month options', () => {
    expect(formatDateKey('2026-08-01', { year: false })).toBe('01 Aug');
    expect(formatDateKey('2026-08-01', { long: true })).toBe('01 August 2026');
  });

  it('rejects anything that is not a YYYY-MM-DD key', () => {
    expect(formatDateKey('2026-8-1')).toBe('—');
    expect(formatDateKey('2026-13-01')).toBe('—');
    expect(formatDateKey('')).toBe('—');
  });

  it('does not shift a stored DATE column by a day', () => {
    // The regression: expenses.expense_date is a DATE ("2026-08-01"), and
    // `new Date('2026-08-01')` parses date-ONLY strings as UTC, then renders
    // device-local — so west of UTC an expense filed on 1 Aug displayed as
    // 31 Jul. Formatting the string can't do that.
    const original = process.env.TZ;
    for (const tz of ['Asia/Kuala_Lumpur', 'UTC', 'America/New_York', 'America/Los_Angeles']) {
      process.env.TZ = tz;
      expect(formatDateKey('2026-08-01', { year: false })).toBe('01 Aug');
    }
    process.env.TZ = original;
  });
});

describe('formatMonthLong / formatDayLong', () => {
  it('names the Malaysian month and day', () => {
    expect(formatMonthLong('2026-08-01T03:00:00Z')).toBe('August 2026');
    expect(formatDayLong('2026-08-01T03:00:00Z')).toBe('Saturday, 1 August 2026');
  });

  it('uses the MY calendar day at the boundary, not the UTC one', () => {
    // 17:00Z on 31 Jul is already 01:00 on 1 Aug in Malaysia, so the Jobs
    // header and the Expenses month label must both roll over with MY.
    expect(formatDayLong('2026-07-31T17:00:00Z')).toBe('Saturday, 1 August 2026');
    expect(formatMonthLong('2026-07-31T17:00:00Z')).toBe('August 2026');
  });

  it('degrades to an em dash on unparseable input', () => {
    expect(formatMonthLong('nope')).toBe('—');
    expect(formatDayLong('nope')).toBe('—');
  });
});

describe('myStartOfDay / myStartOfMonth', () => {
  // These decide which day a job lands on and which jobs a period covers, so
  // they get the timezone sweep too.
  const TZS = ['Asia/Kuala_Lumpur', 'UTC', 'America/New_York', 'Australia/Sydney'];

  it('anchors at Malaysian midnight, whatever the device thinks', () => {
    const original = process.env.TZ;
    for (const tz of TZS) {
      process.env.TZ = tz;
      // 11:00 MY on 1 Aug -> the day began at 2026-07-31T16:00Z.
      expect(myStartOfDay('2026-08-01T03:00:00Z').toISOString())
        .toBe('2026-07-31T16:00:00.000Z');
    }
    process.env.TZ = original;
  });

  it('offsets by whole MY days without DST drift', () => {
    // Stepping via setDate() on a device that observes DST would jump 23 or 25
    // hours across a transition; these are exact 24h steps from MY midnight.
    expect(myStartOfDay('2026-08-01T03:00:00Z', 1).toISOString())
      .toBe('2026-08-01T16:00:00.000Z');
    expect(myStartOfDay('2026-08-01T03:00:00Z', -1).toISOString())
      .toBe('2026-07-30T16:00:00.000Z');
    // Across a US DST boundary (1 Nov 2026), still exactly 24h apart.
    const a = myStartOfDay('2026-11-01T03:00:00Z').getTime();
    const b = myStartOfDay('2026-11-01T03:00:00Z', 1).getTime();
    expect(b - a).toBe(86_400_000);
  });

  it('anchors the month to Malaysian time, not the device month', () => {
    const original = process.env.TZ;
    for (const tz of TZS) {
      process.env.TZ = tz;
      // The regression: on a UTC-negative device the LOCAL month was still
      // July at this instant, so "This month" on Earnings covered all of July
      // as well as August.
      expect(myStartOfMonth('2026-08-01T03:00:00Z').toISOString())
        .toBe('2026-07-31T16:00:00.000Z');
    }
    process.env.TZ = original;
  });

  it('rolls the year over correctly', () => {
    expect(myStartOfMonth('2026-12-14T06:00:00Z', 1).toISOString())
      .toBe('2026-12-31T16:00:00.000Z'); // 1 Jan 2027, 00:00 MY
  });
});

describe('formatDateTime', () => {
  it('joins the date and the clock time', () => {
    expect(formatDateTime('2026-07-30T06:30:00Z')).toBe('Thu, 30 Jul, 14:30 pm');
  });

  it('drops the weekday on request', () => {
    expect(formatDateTime('2026-07-30T06:30:00Z', { weekday: false }))
      .toBe('30 Jul, 14:30 pm');
  });

  it('does not double-apply the timezone offset', () => {
    // formatDateTime delegates to formatDate and formatClock, each of which
    // shifts to MY itself. Handing them an already-shifted Date would land
    // 16 hours ahead and roll the date forward a day.
    expect(formatDateTime('2026-07-30T17:00:00Z')).toBe('Fri, 31 Jul, 01:00 am');
  });

  it('degrades to an em dash on unparseable input', () => {
    expect(formatDateTime('nope')).toBe('—');
  });
});
