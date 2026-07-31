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
