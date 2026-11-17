import { formatDateTime, type ClockStyle } from './timeFormat';

// The one reader of a notification. The Notifications screen, its data query
// and a push tap all ask this module; nothing else words a notification or
// checks its link. The download keeps a row's raw details (readNotification);
// the screen words them at draw time (notificationWords), so the Time format
// setting changes the words without a download.
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

/** What a row's words are built from, read once when the list is downloaded. No time text. */
export type NotificationDetails = {
  kind: NotificationKind;
  /** The real job number, shown as its own small item beside the title. */
  jobNumber: string | null;
  clientName: string | null;
  pickupLocation: string | null;
  /** The raw pickup time (ISO). Formatted only when the row is drawn. */
  pickupAt: string | null;
  /** An allowed link, or null: the row leads nowhere and is not a button. */
  link: string | null;
};

export type NotificationWords = { title: string; body: string };

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

/** A row's raw details, with its link checked. Reports a type this app does not know yet. */
export function readNotification(kind: NotificationKind, payload: any): NotificationDetails {
  const p = payload ?? {};
  if (!Object.prototype.hasOwnProperty.call(TITLE, kind)) reportOnce(`Unknown notification type: ${kind}`);
  return {
    kind,
    jobNumber: p.job_number ? String(p.job_number) : null,
    clientName: p.client_name ?? null,
    pickupLocation: p.pickup_location ?? null,
    pickupAt: p.pickup_datetime ?? null,
    link: allowedLink(p.deeplink),
  };
}

/** A row's title and body in the driver's Time format. Parts are joined with commas, never dots. */
export function notificationWords(d: NotificationDetails, clock: ClockStyle = '24h'): NotificationWords {
  const when: string | null = d.pickupAt ? formatDateTime(d.pickupAt, { weekday: false }, clock) : null;
  const parts = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).join(', ');
  const title = TITLE[d.kind] ?? d.kind.replace(/_/g, ' ');

  switch (d.kind) {
    case 'job_assigned':
      return { title, body: parts(d.clientName, d.pickupLocation, when) };
    case 'job_cancelled':
    case 'reassigned':
      return { title, body: d.pickupLocation ?? '' };
    default:
      // pickup_reminder, job_updated, and a type this app does not know yet:
      // plain job details, never raw data.
      return { title, body: parts(d.pickupLocation, when) };
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
