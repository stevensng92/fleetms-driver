// The Job status module: the one place the app reads a job status.
//
// Every screen hands it the status exactly as the dispatcher sends it
// ("in_progress", "cancelled", ...) and gets back everything it needs: the
// words and pill look, whether the job is open or finished, the one action a
// driver may take, and which screen the job opens on. Adding a status the
// dispatcher starts using means adding one row to JOB below. Terms are
// defined in GLOSSARY.md.
//
// Pure apart from the Sentry report: no database or React imports, so tests
// load it alone.
import { toKey, type StatusToneResult } from './statusTone';

/** What a driver can do with the job, on whichever screen shows it. */
export type JobAction =
  /** Pending: Accept and Reject. */
  | 'acceptReject'
  /** Confirmed: "On my way". */
  | 'onMyWay'
  /** In progress: open the trip screen. */
  | 'openTrip'
  /** Finished jobs and unknown statuses: nothing but "Back to jobs". */
  | 'backToJobs';

export type JobStatusInfo = {
  /** The pill: words, tone, icon, ticked or crossed out. */
  pill: StatusToneResult;
  /** Open jobs still need the driver and stay in the main list. An unknown status counts as open. */
  phase: 'open' | 'finished';
  action: JobAction;
  /** In progress opens the trip screen; everything else the job screen. */
  screen: 'trip' | 'job';
  /** In progress: the dark card on the Jobs list and the glowing pill. */
  live: boolean;
  /** A status this version of the app does not know yet. */
  unknown: boolean;
};

type Row = Omit<JobStatusInfo, 'unknown' | 'live' | 'screen'>;

const FINISHED_LOOK = { tone: 'neutral', icon: 'ban', struck: true } as const;

const JOB: Record<string, Row> = {
  pending: { pill: { tone: 'amber', label: 'Pending', icon: 'clock' }, phase: 'open', action: 'acceptReject' },
  confirmed: { pill: { tone: 'green', label: 'Confirmed', icon: 'circleCheck' }, phase: 'open', action: 'onMyWay' },
  in_progress: { pill: { tone: 'blue', label: 'In Progress', icon: 'navigation' }, phase: 'open', action: 'openTrip' },
  done: { pill: { tone: 'neutral', label: 'Done', icon: 'check', done: true }, phase: 'finished', action: 'backToJobs' },
  // Rejected looks like Cancelled but keeps its own word: the driver's own
  // decision, versus dispatch calling it off.
  rejected: { pill: { ...FINISHED_LOOK, label: 'Rejected' }, phase: 'finished', action: 'backToJobs' },
  cancelled: { pill: { ...FINISHED_LOOK, label: 'Cancelled' }, phase: 'finished', action: 'backToJobs' },
};

// Each unknown word is reported once per app run, not on every render.
const reported = new Set<string>();
/** For tests: forget which unknown statuses were already reported. */
export const resetUnknownReported = () => reported.clear();

function report(key: string) {
  if (reported.has(key)) return;
  reported.add(key);
  // Lazy require so a test that never meets an unknown status needs no Sentry mock.
  try { require('@sentry/react-native').captureMessage(`Unknown job_status: ${key}`, 'warning'); } catch {}
}

/** "on_hold" reads "On hold": still the dispatcher's word, just not in code form. */
function humanise(key: string): string {
  const words = key.replace(/_/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Unknown';
}

export function jobStatus(status: string): JobStatusInfo {
  const key = toKey(status ?? '');
  const row = JOB[key];
  if (row) {
    return {
      ...row,
      pill: { ...row.pill },
      screen: row.action === 'openTrip' ? 'trip' : 'job',
      live: row.action === 'openTrip',
      unknown: false,
    };
  }
  report(key);
  return {
    pill: { tone: 'neutral', label: humanise(key), icon: null },
    phase: 'open',
    action: 'backToJobs',
    screen: 'job',
    live: false,
    unknown: true,
  };
}
