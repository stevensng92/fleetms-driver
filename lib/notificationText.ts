import { formatDateTime, type ClockStyle } from './timeFormat';

// Pure words and rules for the notification rows. They live here, not in
// lib/queries/notifications.ts, because that file builds a live database
// client when it is imported.

export type NotificationKind =
  | 'job_assigned'
  | 'job_updated'
  | 'job_cancelled'
  | 'reassigned'
  | 'pickup_reminder'
  | string; // open for future kinds

const TITLE: Record<string, string> = {
  job_assigned: 'New job',
  job_updated: 'Job updated',
  job_cancelled: 'Job cancelled',
  reassigned: 'Reassigned',
  pickup_reminder: 'Pickup soon',
};

export type NotificationParts = {
  title: string;
  /** The real job number, shown as its own small item beside the title. */
  jobNumber: string | null;
  body: string;
};

/** Title, job number and body from a push_log payload. Parts are joined with commas, never dots. */
export function notificationText(kind: NotificationKind, payload: any, clock: ClockStyle = '24h'): NotificationParts {
  const p = payload ?? {};
  const jobNumber: string | null = p.job_number ? String(p.job_number) : null;
  const when: string | null = p.pickup_datetime ? formatDateTime(p.pickup_datetime, { weekday: false }, clock) : null;
  const parts = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).join(', ');
  const title = TITLE[kind] ?? kind.replace(/_/g, ' ');

  switch (kind) {
    case 'job_assigned':
      return { title, jobNumber, body: parts(p.client_name, p.pickup_location, when) };
    case 'pickup_reminder':
    case 'job_updated':
      return { title, jobNumber, body: parts(p.pickup_location, when) };
    case 'job_cancelled':
    case 'reassigned':
      return { title, jobNumber, body: p.pickup_location ?? '' };
    default:
      return { title, jobNumber, body: JSON.stringify(p).slice(0, 120) };
  }
}

// Deeplinks come from server-controlled push_log.payload.deeplink. Allowlist
// by prefix so a compromised or buggy trigger can't route the driver to an
// unexpected screen. A row with no usable link is not a button.
const ALLOWED_LINKS = ['/jobs/', '/notifications', '/(tabs)', '/profile/'];

export function notificationLink(deeplink: string | null | undefined): string | null {
  if (!deeplink) return null;
  return ALLOWED_LINKS.some((p) => deeplink.startsWith(p)) ? deeplink : null;
}

/** "12 Dec, 09:22" (or "12 Dec, 9:22 am" on the 12-hour setting): when the notification was sent. */
export const sentAt = (iso: string, clock: ClockStyle = '24h'): string => formatDateTime(iso, { weekday: false }, clock);

