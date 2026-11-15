import {
  dayCount, entryDays, MISSING_DAY_MESSAGE, pickDay, rangeLabel, requestNote,
  timeOffMeta, upcomingTimeOff, type TimeOffRow,
} from '../timeOff';

// Change 24. pickDay, dayCount, rangeLabel, upcomingTimeOff, timeOffMeta and
// requestNote are ported from the mock (rules.test.ts, profileRules.test.ts).
describe('pickDay', () => {
  it('makes one tap a one-day request, and a later tap the last day', () => {
    let r = pickDay({ start: null, end: null }, '2026-12-20');
    expect(r).toEqual({ start: '2026-12-20', end: '2026-12-20' });
    r = pickDay(r, '2026-12-22');
    expect(r).toEqual({ start: '2026-12-20', end: '2026-12-22' });
  });
  it('starts again on a tap after a range was made', () => {
    expect(pickDay({ start: '2026-12-20', end: '2026-12-22' }, '2026-12-28')).toEqual({ start: '2026-12-28', end: '2026-12-28' });
  });
  it('moves a one-day request to an earlier day', () => {
    expect(pickDay({ start: '2026-12-20', end: '2026-12-20' }, '2026-12-18')).toEqual({ start: '2026-12-18', end: '2026-12-18' });
  });
  it('keeps a one-day request when the same day is tapped again', () => {
    expect(pickDay({ start: '2026-12-20', end: '2026-12-20' }, '2026-12-20')).toEqual({ start: '2026-12-20', end: '2026-12-20' });
  });
});

describe('dayCount and rangeLabel', () => {
  it('counts days inclusive', () => {
    expect(dayCount('2026-12-24', '2026-12-26')).toBe(3);
    expect(dayCount('2026-12-24', '2026-12-24')).toBe(1);
    expect(dayCount('2026-12-31', '2027-01-02')).toBe(3);
  });
  it('writes the range with "to"', () => {
    expect(rangeLabel('2026-12-24', '2026-12-26', 2026)).toBe('Thu, 24 Dec to Sat, 26 Dec');
  });
  it('adds the year only when it is not the current one', () => {
    expect(rangeLabel('2027-01-04', '2027-01-04', 2026)).toBe('Mon, 4 Jan 2027');
    expect(rangeLabel('2027-01-04', '2027-01-04', 2027)).toBe('Mon, 4 Jan');
  });
});

describe('requestNote', () => {
  it('says nothing until a day is picked', () => {
    expect(requestNote({ start: null, end: null })).toBeNull();
  });
  it('nudges a one-day request toward a later day', () => {
    expect(requestNote({ start: '2026-12-20', end: '2026-12-20' })).toBe('1 day requested. Tap a later day for more than one.');
  });
  it('counts a range and names the wait', () => {
    expect(requestNote({ start: '2026-12-20', end: '2026-12-22' })).toBe('3 days requested, awaiting dispatcher approval.');
  });
});

describe('timeOffMeta', () => {
  it('joins the day count and the reason with a comma', () => {
    expect(timeOffMeta({ start: '2026-12-24', end: '2026-12-26', reason: 'leave' })).toBe('3 days, Leave');
    expect(timeOffMeta({ start: '2027-01-04', end: '2027-01-04', reason: 'off_duty' })).toBe('1 day, Off duty');
    expect(timeOffMeta({ start: '2026-12-24', end: '2026-12-25', reason: 'mc' })).toBe('2 days, MC');
  });
});

describe('upcomingTimeOff', () => {
  const row = (id: string, start: string, end: string): TimeOffRow => ({ id, start, end });
  it('lists requests that have not ended, soonest first', () => {
    const list = upcomingTimeOff(
      [row('b', '2026-12-24', '2026-12-26'), row('a', '2026-12-01', '2026-12-11'), row('c', '2026-12-12', '2026-12-12')],
      '2026-12-12',
    );
    expect(list.map((t) => t.id)).toEqual(['c', 'b']);
  });
});

describe('entryDays', () => {
  it('reads the stored half-open range as Malaysian calendar days, end inclusive', () => {
    // 24 Dec 00:00 MY (= 23 Dec 16:00 UTC) up to 27 Dec 00:00 MY.
    expect(entryDays('2026-12-23T16:00:00Z', '2026-12-26T16:00:00Z')).toEqual({ start: '2026-12-24', end: '2026-12-26' });
  });
  it('reads a one-day request as the same day twice', () => {
    expect(entryDays('2026-12-23T16:00:00Z', '2026-12-24T16:00:00Z')).toEqual({ start: '2026-12-24', end: '2026-12-24' });
  });
});

describe('MISSING_DAY_MESSAGE', () => {
  it('says what is missing, in the mock words', () => {
    expect(MISSING_DAY_MESSAGE).toBe('Pick the first day off.');
  });
});
