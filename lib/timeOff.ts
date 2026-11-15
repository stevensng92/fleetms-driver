import { myDateKey } from './timeFormat';

// Pure rules for Request time off and the Profile time-off list (change 24).
// Days are Malaysian "YYYY-MM-DD" keys, as in lib/timeFormat.ts. They live here,
// not in lib/queries/timeOff.ts, because that file builds a live database client
// when it is imported.

export type TimeOffReason = 'leave' | 'mc' | 'off_duty';

export const REASON_LABEL: Record<TimeOffReason, string> = {
  leave: 'Leave',
  mc: 'MC',
  off_duty: 'Off duty',
};

export interface DayRange {
  start: string | null;
  end: string | null;
}

/** What Submit says when it is pressed with no day picked. */
export const MISSING_DAY_MESSAGE = 'Pick the first day off.';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toMs = (key: string) => Date.parse(`${key}T00:00:00Z`);

/**
 * One tap is a one-day request. A later day, tapped next, becomes the last day.
 * Any other tap starts again.
 */
export function pickDay(r: DayRange, day: string): DayRange {
  if (r.start && r.end && r.start === r.end && day > r.start) return { start: r.start, end: day };
  return { start: day, end: day };
}

/** Days from `start` to `end`, both counted. */
export const dayCount = (start: string, end: string): number => Math.round((toMs(end) - toMs(start)) / DAY_MS) + 1;

/** "Sat, 12 Dec", with the year only when it is not `year`. */
function shortDate(key: string, year: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const wd = new Date(toMs(key)).getUTCDay();
  return `${WEEKDAYS[wd]}, ${d} ${MONTHS[m - 1]}${y !== year ? ` ${y}` : ''}`;
}

export function rangeLabel(start: string, end: string, year: number = Number(myDateKey().slice(0, 4))): string {
  if (start === end) return shortDate(start, year);
  return `${shortDate(start, year)} to ${shortDate(end, year)}`;
}

/** The amber line under the calendar, or null before a day is picked. */
export function requestNote(r: DayRange): string | null {
  if (!r.start || !r.end) return null;
  if (r.start === r.end) return '1 day requested. Tap a later day for more than one.';
  return `${dayCount(r.start, r.end)} days requested, awaiting dispatcher approval.`;
}

/** "3 days, Leave": the day count and the reason, joined with a comma. */
export function timeOffMeta(t: { start: string; end: string; reason: TimeOffReason }): string {
  const n = dayCount(t.start, t.end);
  return `${n} ${n === 1 ? 'day' : 'days'}, ${REASON_LABEL[t.reason] ?? t.reason}`;
}

export type TimeOffRow = { id: string; start: string; end: string };

/** Requests that have not ended, soonest first. */
export function upcomingTimeOff<T extends { start: string; end: string }>(list: T[], today: string): T[] {
  return list.filter((t) => t.end >= today).sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * The stored range is half-open ([start, end + 1 day) at Malaysian midnight).
 * This gives the days the driver picked: end is the last day, counted.
 */
export function entryDays(startsAt: string, endsAt: string): { start: string; end: string } {
  const start = myDateKey(startsAt);
  const end = myDateKey(new Date(new Date(endsAt).getTime() - 1));
  return { start, end: end < start ? start : end };
}
