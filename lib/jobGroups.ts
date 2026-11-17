// Pure decisions for the Jobs tab, ported from the design source's rules.ts
// (jobGroups, jobScreen, jobCount, countRose, greeting). No Supabase import, so
// tests load it alone. The download is one flat list of raw jobs; this splits
// it by Malaysian day against a "now" the screen passes in (so the split moves
// at midnight without a download), then adds today's order, the Finished
// today fold, and whether the whole list is empty. Open or finished, and which
// screen a job opens on, come from lib/jobStatus.ts.
import { jobStatus } from './jobStatus';
import { myDateKey, myStartOfDay } from './timeFormat';

/** What the grouping needs from a job. The real `Job` card type fits. */
export type GroupableJob = {
  /** The job status as the dispatcher sends it ("in_progress"). */
  status: string;
  /** The real pickup time (ISO). Decides the job's day and orders today's jobs. */
  pickupAt: string;
};

/** One later day: its Malaysian date ("2026-12-15") and its jobs in pickup order. */
export type UpcomingDay<J extends GroupableJob> = { dateKey: string; jobs: J[] };

export type JobGroups<J extends GroupableJob> = {
  /** Open jobs whose pickup was before the start of today, Malaysian time. */
  overdue: J[];
  /** Today's jobs still to act on: the job under way first, then the rest by pickup time. */
  today: J[];
  /** Today's finished jobs (done, rejected, cancelled), by pickup time. Shown in a closed fold. */
  todayFinished: J[];
  tomorrow: J[];
  /** The days after tomorrow, in date order. */
  upcoming: UpcomingDay<J>[];
  /** Nothing in any group. The "No jobs scheduled today" card shows only then. */
  empty: boolean;
};

/** Oldest pickup first. Array.sort is stable, so equal times keep their order. */
const byPickup = (a: GroupableJob, b: GroupableJob) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime();

/**
 * Splits the flat jobs list by Malaysian day against `now`, then applies the
 * Today rules. Day boundaries come from lib/timeFormat.ts, never the phone's
 * own clock zone, so a phone set to another zone shows the same days.
 */
export function groupJobs<J extends GroupableJob>(jobs: J[], now: Date = new Date()): JobGroups<J> {
  const startYesterday = myStartOfDay(now, -1).getTime();
  const startToday = myStartOfDay(now).getTime();
  const startTomorrow = myStartOfDay(now, 1).getTime();
  const startDayAfter = myStartOfDay(now, 2).getTime();

  const overdue: J[] = [];
  const todayAll: J[] = [];
  const tomorrow: J[] = [];
  const later = new Map<string, J[]>();
  for (const j of [...jobs].sort(byPickup)) {
    const t = new Date(j.pickupAt).getTime();
    if (t < startToday) {
      // The download only carries past jobs that are still open. A job that
      // finished and then slipped into the past while the screen stayed open
      // is not missed, so it leaves the list. A trip under way that was
      // picked up yesterday is a late-night trip running past midnight, not a
      // missed one: it stays with today's jobs. An older one is stuck: Overdue.
      const st = jobStatus(j.status);
      if (st.live && t >= startYesterday) todayAll.push(j);
      else if (st.phase === 'open') overdue.push(j);
    } else if (t < startTomorrow) {
      todayAll.push(j);
    } else if (t < startDayAfter) {
      tomorrow.push(j);
    } else {
      const key = myDateKey(j.pickupAt);
      const day = later.get(key);
      if (day) day.push(j); else later.set(key, [j]);
    }
  }
  const upcoming = [...later.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, js]) => ({ dateKey, jobs: js }));

  const open = todayAll.filter((j) => jobStatus(j.status).phase === 'open');
  const today = [
    ...open.filter((j) => jobStatus(j.status).live),
    ...open.filter((j) => !jobStatus(j.status).live),
  ];
  const todayFinished = todayAll.filter((j) => jobStatus(j.status).phase === 'finished');
  return {
    overdue,
    today,
    todayFinished,
    tomorrow,
    upcoming,
    empty: !overdue.length && !todayAll.length && !tomorrow.length && !upcoming.length,
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
