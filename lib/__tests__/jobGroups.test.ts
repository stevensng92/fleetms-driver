import {
  countRose, getFinishedSeen, greeting, groupJobs, jobCount, jobScreen, resetFinishedSeen, setFinishedSeen, todayHeading,
  type GroupableJob,
} from '../jobGroups';

// Ported from the design source's rules.test.ts (jobGroups, jobScreen, countRose,
// greeting), adapted to the real data: the download is one flat list of raw
// jobs, and groupJobs splits it by Malaysian day against an injected "now"
// before applying the screen's rules on top.

type J = GroupableJob & { id: string };
const job = (id: string, status: string, pickupAt: string): J => ({ id, status, pickupAt });
const ids = (js: J[]) => js.map((j) => j.id);
// Noon on Sat 12 Dec 2026 in Malaysia. That Malaysian day runs from
// 2026-12-11T16:00Z up to 2026-12-12T16:00Z.
const NOW = new Date('2026-12-12T04:00:00Z');
const group = (jobs: J[], now: Date = NOW) => groupJobs(jobs, now);
const days = (g: ReturnType<typeof group>) => g.upcoming.map((d) => [d.dateKey, ids(d.jobs)]);

describe('greeting', () => {
  it("follows the phone's hour in three steps", () => {
    expect(greeting(9)).toBe('Good morning');
    expect(greeting(12)).toBe('Good afternoon');
    expect(greeting(17)).toBe('Good afternoon');
    expect(greeting(18)).toBe('Good evening');
  });
});

describe('jobCount', () => {
  it('says "1 job" and "2 jobs"', () => {
    expect(jobCount(1)).toBe('1 job');
    expect(jobCount(2)).toBe('2 jobs');
    expect(jobCount(0)).toBe('0 jobs');
  });
});

describe('todayHeading (change 10)', () => {
  it('counts the jobs still to do, with no money in it', () => {
    expect(todayHeading(3)).toBe('3 jobs to go');
    expect(todayHeading(1)).toBe('1 job to go');
  });
  it('says All done when none are left', () => {
    expect(todayHeading(0)).toBe('All done');
  });
});

describe('groupJobs day split', () => {
  it('puts each job under Overdue, Today, Tomorrow or a later day, by Malaysian day', () => {
    const g = group([
      job('overdue', 'pending', '2026-12-10T02:00:00Z'),
      job('today', 'confirmed', '2026-12-12T02:00:00Z'),
      job('tomorrow', 'pending', '2026-12-13T02:00:00Z'),
      job('later', 'confirmed', '2026-12-15T02:00:00Z'),
    ]);
    expect(ids(g.overdue)).toEqual(['overdue']);
    expect(ids(g.today)).toEqual(['today']);
    expect(ids(g.tomorrow)).toEqual(['tomorrow']);
    expect(days(g)).toEqual([['2026-12-15', ['later']]]);
  });

  it('splits jobs either side of Malaysian midnight into different days', () => {
    const g = group([
      job('last-second-yesterday', 'pending', '2026-12-11T15:59:59Z'), // 23:59:59 on 11 Dec, MY
      job('first-second-today', 'pending', '2026-12-11T16:00:00Z'),    // 00:00:00 on 12 Dec, MY
      job('last-second-today', 'pending', '2026-12-12T15:59:59Z'),
      job('first-second-tomorrow', 'pending', '2026-12-12T16:00:00Z'),
      job('last-second-tomorrow', 'pending', '2026-12-13T15:59:59Z'),
      job('first-second-later', 'pending', '2026-12-13T16:00:00Z'),
    ]);
    expect(ids(g.overdue)).toEqual(['last-second-yesterday']);
    expect(ids(g.today)).toEqual(['first-second-today', 'last-second-today']);
    expect(ids(g.tomorrow)).toEqual(['first-second-tomorrow', 'last-second-tomorrow']);
    expect(days(g)).toEqual([['2026-12-14', ['first-second-later']]]);
  });

  it('moves a job from Tomorrow to Today once now crosses Malaysian midnight', () => {
    const j = [job('J', 'confirmed', '2026-12-12T02:00:00Z')];
    expect(ids(group(j, new Date('2026-12-11T15:59:59Z')).tomorrow)).toEqual(['J']);
    expect(ids(group(j, new Date('2026-12-11T16:00:00Z')).today)).toEqual(['J']);
  });

  it("moves yesterday's open job under Overdue after midnight, and drops yesterday's finished one", () => {
    // The download only carries past jobs that are still open, so a finished
    // job that slips into the past while the screen is open leaves the list
    // rather than showing as Missed.
    const j = [job('open', 'confirmed', '2026-12-11T10:00:00Z'), job('done', 'done', '2026-12-11T11:00:00Z')];
    const before = group(j, new Date('2026-12-11T15:59:59Z'));
    expect(ids(before.today)).toEqual(['open']);
    expect(ids(before.todayFinished)).toEqual(['done']);
    const after = group(j, new Date('2026-12-11T16:00:00Z'));
    expect(ids(after.overdue)).toEqual(['open']);
    expect(after.today).toEqual([]);
    expect(after.todayFinished).toEqual([]);
  });

  it('keeps an open job from 30 days back under Overdue', () => {
    const g = group([job('old', 'in_progress', '2026-11-12T02:00:00Z')]);
    expect(ids(g.overdue)).toEqual(['old']);
  });

  it('groups later days by Malaysian date, in date order', () => {
    const g = group([
      job('a', 'pending', '2026-12-16T01:00:00Z'),
      job('b', 'pending', '2026-12-14T03:00:00Z'),
      job('c', 'pending', '2026-12-16T18:00:00Z'), // 02:00 on 17 Dec in Malaysia, not 16 Dec
      job('d', 'pending', '2026-12-15T23:00:00Z'), // 07:00 on 16 Dec in Malaysia
    ]);
    expect(days(g)).toEqual([
      ['2026-12-14', ['b']],
      ['2026-12-16', ['d', 'a']], // by pickup time within the day
      ['2026-12-17', ['c']],
    ]);
  });

  it("does not move a job's day when the phone is set to another time zone", () => {
    const original = process.env.TZ;
    const j = [
      job('yesterday', 'pending', '2026-12-11T15:59:59Z'),
      job('today', 'pending', '2026-12-11T16:00:00Z'),
      job('tomorrow', 'pending', '2026-12-12T16:00:00Z'),
      job('later', 'pending', '2026-12-13T16:00:00Z'),
    ];
    try {
      for (const tz of ['UTC', 'America/New_York', 'Australia/Sydney']) {
        process.env.TZ = tz;
        const g = group(j);
        expect([ids(g.overdue), ids(g.today), ids(g.tomorrow), g.upcoming.map((d) => d.dateKey)])
          .toEqual([['yesterday'], ['today'], ['tomorrow'], ['2026-12-14']]);
      }
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('groupJobs today (change 32)', () => {
  const g = group([
    job('late', 'confirmed', '2026-12-12T11:00:00Z'),
    job('under-way', 'in_progress', '2026-12-12T01:15:00Z'),
    job('morning-done', 'done', '2026-12-11T22:30:00Z'),
    job('mid', 'pending', '2026-12-12T06:30:00Z'),
    job('cancelled', 'cancelled', '2026-12-12T13:30:00Z'),
    job('turned-down', 'rejected', '2026-12-12T14:00:00Z'),
    job('on-hold', 'on_hold', '2026-12-12T12:00:00Z'),
  ]);

  it('puts the job under way first, then the jobs still to do by pickup time', () => {
    expect(ids(g.today)).toEqual(['under-way', 'mid', 'late', 'on-hold']);
  });
  it('moves done, cancelled and rejected jobs into the finished fold, by pickup time', () => {
    expect(ids(g.todayFinished)).toEqual(['morning-done', 'cancelled', 'turned-down']);
  });
  it('orders several jobs under way by pickup time, ahead of every job still to do', () => {
    const day = group([
      job('A', 'confirmed', '2026-12-12T00:00:00Z'),
      job('B', 'in_progress', '2026-12-12T03:00:00Z'),
      job('C', 'in_progress', '2026-12-12T02:00:00Z'),
    ]);
    expect(ids(day.today)).toEqual(['C', 'B', 'A']);
  });
  it('keeps the incoming order for jobs with the same pickup time', () => {
    const day = group([job('first', 'confirmed', '2026-12-12T02:00:00Z'), job('second', 'pending', '2026-12-12T02:00:00Z')]);
    expect(ids(day.today)).toEqual(['first', 'second']);
  });
  it('does not reorder the other groups by status', () => {
    const r = group([
      job('o', 'pending', '2026-12-10T02:00:00Z'),
      job('t1', 'pending', '2026-12-13T02:00:00Z'),
      job('t2', 'in_progress', '2026-12-13T05:00:00Z'),
      job('u', 'confirmed', '2026-12-15T02:00:00Z'),
    ]);
    expect(ids(r.overdue)).toEqual(['o']);
    expect(ids(r.tomorrow)).toEqual(['t1', 't2']);
    expect(r.upcoming.map((d) => ids(d.jobs))).toEqual([['u']]);
  });
});

describe('groupJobs empty (change 15)', () => {
  it('is empty only when nothing at all is coming', () => {
    expect(group([]).empty).toBe(true);
  });
  it('is not empty when only an upcoming day has a job', () => {
    expect(group([job('u', 'confirmed', '2026-12-15T02:00:00Z')]).empty).toBe(false);
  });
  it('is not empty for an overdue job or a tomorrow job', () => {
    expect(group([job('o', 'pending', '2026-12-10T02:00:00Z')]).empty).toBe(false);
    expect(group([job('t', 'pending', '2026-12-13T02:00:00Z')]).empty).toBe(false);
  });
  it('still counts a day of only finished jobs as something to show', () => {
    const day = group([job('d', 'done', '2026-12-12T02:00:00Z')]);
    expect(day.today).toEqual([]);
    expect(day.todayFinished).toHaveLength(1);
    expect(day.empty).toBe(false);
  });
});

describe('jobScreen (change 14)', () => {
  it('opens an in-progress job on the trip screen, wherever its card sits', () => {
    expect(jobScreen({ status: 'in_progress' })).toBe('trip');
    expect(jobScreen({ status: 'on_hold' })).toBe('job');
    expect(jobScreen({ status: 'confirmed' })).toBe('job');
    expect(jobScreen({ status: 'pending' })).toBe('job');
    expect(jobScreen({ status: 'done' })).toBe('job');
  });
});

describe('countRose (change 36)', () => {
  it('bumps when the count grew since the driver last saw it', () => {
    expect(countRose(2, 3)).toBe(true);
  });
  it('stays still the first time, and when the count held or fell', () => {
    expect(countRose(null, 3)).toBe(false);
    expect(countRose(3, 3)).toBe(false);
    expect(countRose(3, 2)).toBe(false);
  });
});

describe('last seen Finished today count', () => {
  it('starts empty, remembers a count, and can be cleared', () => {
    resetFinishedSeen();
    expect(getFinishedSeen()).toBeNull();
    setFinishedSeen(2);
    expect(getFinishedSeen()).toBe(2);
    resetFinishedSeen();
    expect(getFinishedSeen()).toBeNull();
  });
});

// Value: protects=a trip under way is never shown as missed when midnight passes; fails_when=an in_progress job picked up before today lands in Overdue; why_new=the overdue tests only use pending and confirmed jobs; seam=none; no_claim=none beyond protects
describe('groupJobs: a trip under way across midnight', () => {
  it('keeps an In progress job picked up yesterday with today, never Overdue', () => {
    // 23:30 Malaysian time on Fri 11 Dec, seen at 00:30 on Sat 12 Dec.
    const live = job('LIVE', 'in_progress', '2026-12-11T15:30:00Z');
    const g = group([live], new Date('2026-12-11T16:30:00Z'));
    expect(ids(g.overdue)).toEqual([]);
    expect(ids(g.today)).toEqual(['LIVE']);
  });
});
