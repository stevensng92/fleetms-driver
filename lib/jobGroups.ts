// Pure decisions for the Jobs tab, ported from the design source's rules.ts
// (jobGroups, jobScreen, jobCount, countRose, greeting). No Supabase import, so
// tests load it alone. The query already splits jobs by Malaysia day; this adds
// what the screen needs on top: today's order, the Finished today fold, and
// whether the whole list is empty. Open or finished, and which screen a job
// opens on, come from lib/jobStatus.ts.
import { jobStatus } from './jobStatus';

/** What the grouping needs from a job. The real `Job` card type fits. */
export type GroupableJob = {
  /** The job status as the dispatcher sends it ("in_progress"). */
  status: string;
  /** The real pickup time (ISO). Orders today's jobs. */
  pickupAt?: string;
};

export type JobsData<J extends GroupableJob> = {
  overdue: J[];
  today: J[];
  tomorrow: J[];
  upcoming: { dateKey: string; label: string; jobs: J[] }[];
};

export type JobGroups<J extends GroupableJob> = {
  overdue: J[];
  /** Today's jobs still to act on: the job under way first, then the rest by pickup time. */
  today: J[];
  /** Today's finished jobs (done, rejected, cancelled), by pickup time. Shown in a closed fold. */
  todayFinished: J[];
  tomorrow: J[];
  upcoming: JobsData<J>['upcoming'];
  /** Nothing in any group. The "No jobs scheduled today" card shows only then. */
  empty: boolean;
};

/** Oldest pickup first. Array.sort is stable, so equal or missing times keep their order. */
const byPickup = (a: GroupableJob, b: GroupableJob) => (a.pickupAt ?? '').localeCompare(b.pickupAt ?? '');

export function groupJobs<J extends GroupableJob>(d: JobsData<J>): JobGroups<J> {
  const sorted = [...d.today].sort(byPickup);
  const open = sorted.filter((j) => jobStatus(j.status).phase === 'open');
  const today = [
    ...open.filter((j) => jobStatus(j.status).live),
    ...open.filter((j) => !jobStatus(j.status).live),
  ];
  const todayFinished = sorted.filter((j) => jobStatus(j.status).phase === 'finished');
  return {
    overdue: d.overdue,
    today,
    todayFinished,
    tomorrow: d.tomorrow,
    upcoming: d.upcoming,
    empty: !d.overdue.length && !sorted.length && !d.tomorrow.length && !d.upcoming.length,
  };
}

/** Every in-progress job opens the trip screen, from whichever group its card sits in. */
export const jobScreen = (j: Pick<GroupableJob, 'status'>): 'trip' | 'job' => jobStatus(j.status).screen;

export const jobCount = (n: number) => `${n} ${n === 1 ? 'job' : 'jobs'}`;

/** The Today heading's count: what is still to do, no money. */
export const todayHeading = (toGo: number) => (toGo > 0 ? `${jobCount(toGo)} to go` : 'All done');

/**
 * Time-of-day greeting for the device's local hour, in three steps so we don't
 * say "Good afternoon" at 1pm and "Good evening" at 5pm.
 *
 * DELIBERATELY device-local, and the only such reading left in the app. Every
 * other clock and date is pinned to Malaysia (lib/timeFormat.ts) because it
 * describes a JOB, which happens on MY time. A greeting describes the DRIVER,
 * so it follows the phone they hold. Don't "fix" this to match.
 */
export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Whether the Finished today count grew since the driver last saw it, so it
 * bumps once. `last` is null the first time the count is shown: nothing to
 * compare, so no bump.
 */
export const countRose = (last: number | null, now: number): boolean => last !== null && now > last;

// The count the driver last saw. Kept outside the screen because a job is
// usually marked done on the trip screen, so the fold is drawn fresh when the
// driver comes back to Jobs.
let finishedSeen: number | null = null;
export const getFinishedSeen = () => finishedSeen;
export const setFinishedSeen = (n: number) => { finishedSeen = n; };
export const resetFinishedSeen = () => { finishedSeen = null; };
