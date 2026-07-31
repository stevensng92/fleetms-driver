import { formatClock, formatDateTime } from '../timeFormat';

// The house format is 24-hour digits with the am/pm marker KEPT behind them
// ("14:30 pm"). That marker is redundant after noon and is retained on purpose
// — see the header comment in lib/timeFormat.ts. These tests pin that decision
// so a future "cleanup" that drops the suffix fails loudly instead of silently
// changing every clock in the app.

describe('formatClock', () => {
  // Local-component Date constructor (y, m, d, h, min) means these assertions
  // hold in ANY timezone — they describe wall-clock time, which is exactly what
  // the function formats.
  const at = (h: number, m: number) => new Date(2026, 6, 30, h, m);

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

  it('accepts an ISO string, resolved in MY local time', () => {
    // 06:30Z is 14:30 in Asia/Kuala_Lumpur (UTC+8), pinned by test/globalSetup.js.
    expect(formatClock('2026-07-30T06:30:00Z')).toBe('14:30 pm');
  });

  it('degrades to an em dash rather than rendering NaN', () => {
    expect(formatClock('not-a-date')).toBe('—');
    expect(formatClock('')).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('joins the date and the clock time', () => {
    expect(formatDateTime('2026-07-30T06:30:00Z')).toBe('Thu, 30 Jul, 14:30 pm');
  });

  it('honours a caller-supplied date format', () => {
    expect(formatDateTime('2026-07-30T06:30:00Z', { day: '2-digit', month: 'short' }))
      .toBe('30 Jul, 14:30 pm');
  });

  it('degrades to an em dash on unparseable input', () => {
    expect(formatDateTime('nope')).toBe('—');
  });
});
