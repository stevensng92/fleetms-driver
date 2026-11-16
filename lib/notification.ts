import { formatDateTime, type ClockStyle } from './timeFormat';

// The one reader of a notification. The Notifications screen, its data query
// and a push tap all ask this module; nothing else words a notification or
// checks its link.
//
// Pure apart from the Sentry report: no database client at import time
// (lib/queries/notifications.ts builds one), so it is tested without mocks.

export type NotificationKind =
  | 'job_assigned'
  | 'job_updated'
  | 'job_cancelled'
  | 'reassigned'
  | 'pickup_reminder'
  | string; // open for future types

const TITLE: Record<string, string> = {
  job_assigned: 'New job',
  job_updated: 'Job updated',
  job_cancelled: 'Job cancelled',
  reassigned: 'Reassigned',
  pickup_reminder: 'Pickup soon',
};

export type NotificationView = {
  title: string;
  /** The real job number, shown as its own small item beside the title. */
  jobNumber: string | null;
  body: string;
  /** An allowed link, or null: the row leads nowhere and is not a button. */
  link: string | null;
};

export type PushTap = {
  /** Always somewhere the app can open: the Notifications screen when the push's own link is missing or refused. */
  link: string;
  /** The matching Notifications screen row, to mark read; null when the push names none. */
  rowId: string | null;
};

// Each unknown type and each refused link is reported once per app run, not
// on every render.
const reported = new Set<string>();
/** For tests: forget what was already reported. */
export const resetNotificationReported = () => reported.clear();

function reportOnce(message: string) {
  if (reported.has(message)) return;
  reported.add(message);
  // Lazy require so a test that never meets one needs no Sentry mock.
  try { require('@sentry/react-native').captureMessage(message, 'warning'); } catch {}
}

// Links come from server-controlled data (push_log.payload.deeplink, which is
// also the data inside a push). Only these exact shapes open, so a buggy or
// compromised trigger cannot route a driver to an unexpected screen. Shapes,
// not prefixes: '/(tabs)' must not let '/(tabs)/../x' through.
const ALLOWED_LINKS: RegExp[] = [
  /^\/jobs\/[A-Za-z0-9_-]+$/, // what the dispatcher sends for job alerts
  /^\/\(tabs\)$/,             // what the dispatcher sends for a reassignment
  /^\/notifications$/,
  /^\/profile\/time-off$/,
];

function allowedLink(deeplink: unknown): string | null {
  if (typeof deeplink !== 'string' || deeplink === '') return null;
  if (ALLOWED_LINKS.some((re) => re.test(deeplink))) return deeplink;
  reportOnce(`Refused notification link: ${deeplink}`);
  return null;
}

/** Title, job number, body and allowed link for a Notifications screen row. Parts are joined with commas, never dots. */
export function readNotification(kind: NotificationKind, payload: any, clock: ClockStyle = '24h'): NotificationView {
  const p = payload ?? {};
  const jobNumber: string | null = p.job_number ? String(p.job_number) : null;
  const when: string | null = p.pickup_datetime ? formatDateTime(p.pickup_datetime, { weekday: false }, clock) : null;
  const parts = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).join(', ');
  const title = TITLE[kind] ?? kind.replace(/_/g, ' ');
  const link = allowedLink(p.deeplink);

  switch (kind) {
    case 'job_assigned':
      return { title, jobNumber, body: parts(p.client_name, p.pickup_location, when), link };
    case 'pickup_reminder':
    case 'job_updated':
      return { title, jobNumber, body: parts(p.pickup_location, when), link };
    case 'job_cancelled':
    case 'reassigned':
      return { title, jobNumber, body: p.pickup_location ?? '', link };
    default:
      // A type this app does not know yet: plain job details, never raw data.
      reportOnce(`Unknown notification type: ${kind}`);
      return { title, jobNumber, body: parts(p.pickup_location, when), link };
  }
}

/** Where a tapped push goes, and which row it marks read. The push's data is the row's payload plus push_log_id. */
export function readPushTap(data: any): PushTap {
  const d = data ?? {};
  return {
    link: allowedLink(d.deeplink) ?? '/notifications',
    rowId: typeof d.push_log_id === 'string' && d.push_log_id !== '' ? d.push_log_id : null,
  };
}

/** "12 Dec, 09:22" (or "12 Dec, 9:22 am" on the 12-hour setting): when the notification was sent. */
export const sentAt = (iso: string, clock: ClockStyle = '24h'): string => formatDateTime(iso, { weekday: false }, clock);
