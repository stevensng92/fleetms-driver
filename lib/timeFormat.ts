// Clock-time formatting for the driver app.
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
// Built by hand rather than through Intl: there is no toLocaleTimeString
// option pair that yields 24h digits AND an am/pm marker (hour12:false
// suppresses the marker), and hand-rolling also sidesteps Hermes' patchy Intl
// support on Android, where locale output has historically differed from the
// web build.
//
// All inputs are timestamptz ISO strings from Supabase, so getHours() reads
// the device's local wall clock — the same basis the previous
// toLocaleTimeString calls used. Drivers and jobs are both in MY.

/** "14:30 pm" / "09:00 am". Returns an em dash for an unparseable input. */
export function formatClock(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const h = d.getHours();
  return `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** "Thu, 30 Jul, 14:30 pm" — timestamp label for notification rows. */
export function formatDateTime(
  value: string | Date,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short' },
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-MY', opts)}, ${formatClock(d)}`;
}
