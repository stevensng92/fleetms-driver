// Clock and date formatting for the driver app.
//
// House format is 24-hour digits with the am/pm marker kept behind them:
// "09:00 am", "14:30 pm", "23:05 pm".
//
// The marker is redundant after 12:00 — the 24h digits already disambiguate.
// Keep it anyway: this is an explicit product decision (Steven, 2026-07-31),
// not an oversight. The digits are the unambiguous part a driver reads, and
// the marker is the familiar anchor that stops "14:30" reading as a typo.
// Do not "fix" this into strict 24h without asking.
//
// TIMEZONE IS PINNED TO MALAYSIA, NOT THE DEVICE.
// This used to read the device's local clock via getHours(), which made the
// driver app the only FleetMS surface whose timezone was an assumption rather
// than a fact. The dispatcher web app pins the zone explicitly
// (`timeZone: MY_TZ` in JobPanel/Payments/Registry) and the push edge function
// applies a fixed +8, so a phone with a wrong auto-timezone — or a driver
// roaming — would show a pickup time no other surface agreed with, and neither
// the driver nor the dispatcher could reproduce it.
//
// The offset is applied as a fixed shift rather than through
// `Intl.DateTimeFormat({ timeZone })` on purpose:
//   - Malaysia has been UTC+8 with no DST since 1982, so a fixed offset is
//     exact, not an approximation.
//   - It keeps this module free of Intl entirely, which matters because Hermes
//     on Android has patchy Intl support and its locale output has historically
//     differed from the web build. Everything here is now deterministic across
//     engines, so the tests actually predict what a driver sees.
//   - It matches what the push edge function already does
//     (`d.getTime() + 8 * 60 * 60 * 1000`), so the two agree by construction.
// If Malaysia ever changes offset, change MY_UTC_OFFSET_MIN here and in
// ../fleetms/supabase/functions/send-driver-push/index.ts together.

const MY_UTC_OFFSET_MIN = 8 * 60;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Shift an instant so its UTC components read as Malaysian wall-clock time. */
function toMyParts(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + MY_UTC_OFFSET_MIN * 60_000);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "14:30 pm" / "09:00 am", in Malaysian time. Em dash on unparseable input. */
export function formatClock(value: string | Date): string {
  const my = toMyParts(value);
  if (!my) return '—';
  const h = my.getUTCHours();
  return `${pad2(h)}:${pad2(my.getUTCMinutes())} ${h < 12 ? 'am' : 'pm'}`;
}

/** "30 Jul" — Malaysian calendar date, no year. */
export function formatDate(value: string | Date, opts: { weekday?: boolean } = {}): string {
  const my = toMyParts(value);
  if (!my) return '—';
  const core = `${pad2(my.getUTCDate())} ${MONTHS[my.getUTCMonth()]}`;
  return opts.weekday ? `${WEEKDAYS[my.getUTCDay()]}, ${core}` : core;
}

/**
 * "01 Aug 2026" from a "2026-08-01" key.
 *
 * Formats the STRING directly, with no Date in the middle — a YYYY-MM-DD key is
 * already a calendar day, so round-tripping it through Date only creates an
 * opportunity to apply a timezone to something that doesn't have one.
 */
export function formatDateKey(key: string, opts: { year?: boolean; long?: boolean } = {}): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return '—';
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return '—';
  const month = opts.long ? MONTHS_LONG[monthIdx] : MONTHS[monthIdx];
  const core = `${m[3]} ${month}`;
  return opts.year === false ? core : `${core} ${m[1]}`;
}

/** "August 2026" — the Malaysian month containing `value`. */
export function formatMonthLong(value: string | Date = new Date()): string {
  const my = toMyParts(value);
  if (!my) return '—';
  return `${MONTHS_LONG[my.getUTCMonth()]} ${my.getUTCFullYear()}`;
}

/** "Friday, 1 August 2026" — the Malaysian day containing `value`. */
export function formatDayLong(value: string | Date = new Date()): string {
  const my = toMyParts(value);
  if (!my) return '—';
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][my.getUTCDay()];
  return `${weekday}, ${my.getUTCDate()} ${MONTHS_LONG[my.getUTCMonth()]} ${my.getUTCFullYear()}`;
}

/** "1 August 2026" — long-form Malaysian date, for one-off display labels. */
export function formatDateLong(value: string | Date): string {
  const my = toMyParts(value);
  if (!my) return '—';
  return `${my.getUTCDate()} ${MONTHS_LONG[my.getUTCMonth()]} ${my.getUTCFullYear()}`;
}

/**
 * "2026-08-01" — the Malaysian calendar day, for values STORED as a date
 * (e.g. expenses.expense_date) rather than displayed.
 *
 * Never build these with `new Date().toISOString().slice(0, 10)`. That is the
 * UTC day, and Malaysia is UTC+8 — so between 00:00 and 08:00 local, the UTC
 * day is still YESTERDAY. A driver logging fuel after a pre-dawn airport run
 * would see one date on screen and store the day before, landing the expense in
 * the wrong month at a period boundary.
 */
export function myDateKey(value: string | Date = new Date()): string {
  const my = toMyParts(value);
  if (!my) return '—';
  return `${my.getUTCFullYear()}-${pad2(my.getUTCMonth() + 1)}-${pad2(my.getUTCDate())}`;
}

/**
 * "2026-08-01" — first day of the Malaysian month containing `value`, shifted
 * by `monthOffset` months. Pass 1 for the exclusive upper bound of a month
 * range.
 *
 * Same trap as myDateKey, one level up: `new Date(y, m, 1).toISOString()` looks
 * like it builds a month boundary, but it builds LOCAL midnight and then prints
 * it in UTC. At UTC+8 that lands at 16:00 on the LAST DAY OF THE PREVIOUS
 * MONTH, so a "this month" range quietly swallows one extra day of the month
 * before — which for an expenses total is a wrong number in a wrong month.
 */
export function myMonthStartKey(value: string | Date = new Date(), monthOffset = 0): string {
  const my = toMyParts(value);
  if (!my) return '—';
  // Month arithmetic via Date.UTC so December + 1 rolls the year correctly.
  const anchor = new Date(Date.UTC(my.getUTCFullYear(), my.getUTCMonth() + monthOffset, 1));
  return `${anchor.getUTCFullYear()}-${pad2(anchor.getUTCMonth() + 1)}-01`;
}

/**
 * The INSTANT at which a Malaysian calendar day begins, offset by `dayOffset`
 * days. Use for range boundaries against a timestamptz column.
 *
 * `x.setHours(0, 0, 0, 0)` is the tempting version and it is device-local: on a
 * phone outside MY it anchors the wrong day, so "Today" on the Jobs tab and
 * "This week" on Earnings would cover a different window than the clock beside
 * them claims. Same reasoning as pinning formatClock — a boundary is just a
 * clock reading you compare against.
 */
export function myStartOfDay(value: string | Date = new Date(), dayOffset = 0): Date {
  const my = toMyParts(value);
  if (!my) return new Date(NaN);
  const utcMidnightMy = Date.UTC(
    my.getUTCFullYear(), my.getUTCMonth(), my.getUTCDate() + dayOffset,
  );
  // That timestamp is MY-wall-clock midnight expressed as UTC; subtract the
  // offset to get the real instant.
  return new Date(utcMidnightMy - MY_UTC_OFFSET_MIN * 60_000);
}

/** The instant at which the Malaysian month containing `value` begins. */
export function myStartOfMonth(value: string | Date = new Date(), monthOffset = 0): Date {
  const my = toMyParts(value);
  if (!my) return new Date(NaN);
  const utcMonthStartMy = Date.UTC(my.getUTCFullYear(), my.getUTCMonth() + monthOffset, 1);
  return new Date(utcMonthStartMy - MY_UTC_OFFSET_MIN * 60_000);
}

/**
 * "Thu, 30 Jul, 14:30 pm" — timestamp label for notification rows.
 * Pass `{ weekday: false }` for the shorter "30 Jul, 14:30 pm".
 */
export function formatDateTime(
  value: string | Date,
  opts: { weekday?: boolean } = { weekday: true },
): string {
  // Pass the ORIGINAL value down, never the shifted one — formatDate and
  // formatClock each apply the offset themselves, so handing them an
  // already-shifted Date would land 16 hours ahead.
  if (!toMyParts(value)) return '—';
  return `${formatDate(value, opts)}, ${formatClock(value)}`;
}
