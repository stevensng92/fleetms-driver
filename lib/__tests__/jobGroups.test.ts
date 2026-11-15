import {
  countRose, getFinishedSeen, greeting, groupJobs, jobCount, jobScreen, resetFinishedSeen, setFinishedSeen, todayHeading,
  type GroupableJob, type JobsData,
} from '../jobGroups';

// Ported from the design source's rules.test.ts (jobGroups, jobScreen, countRose,
// greeting), adapted to the real data: the query already splits the days, so
// these tests start from its shape and check what the screen needs on top.

type J = GroupableJob & { id: string };
const job = (id: string, status: GroupableJob['status'], pickupAt: string, rawStatus?: string): J => ({ id, status, pickupAt, rawStatus });
const data = (over: Partial<JobsData<J>> = {}): JobsData<J> => ({ overdue: [], today: [], tomorrow: [], upcoming: [], ...over });
const ids = (js: J[]) => js.map((j) => j.id);

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

describe('groupJobs today (change 32)', () => {
  const today = [
    job('late', 'confirmed', '2026-12-12T11:00:00Z'),
    job('under-way', 'progress', '2026-12-12T01:15:00Z'),
    job('morning-done', 'done', '2026-12-11T22:30:00Z'),
    job('mid', 'pending', '2026-12-12T06:30:00Z'),
    job('cancelled', 'voided', '2026-12-12T13:30:00Z', 'cancelled'),
  ];
  const g = groupJobs(data({ today }));

  it('puts the job under way first, then the jobs still to do by pickup time', () => {
    expect(ids(g.today)).toEqual(['under-way', 'mid', 'late']);
  });
  it('moves done and cancelled jobs into the finished fold, by pickup time', () => {
    expect(ids(g.todayFinished)).toEqual(['morning-done', 'cancelled']);
  });
  it('orders several jobs under way by pickup time, ahead of every job still to do', () => {
    const day = groupJobs(data({
      today: [
        job('A', 'confirmed', '2026-12-12T00:00:00Z'),
        job('B', 'progress', '2026-12-12T03:00:00Z'),
        job('C', 'progress', '2026-12-12T02:00:00Z'),
      ],
    }));
    expect(ids(day.today)).toEqual(['C', 'B', 'A']);
  });
  it('keeps the incoming order for jobs with the same pickup time', () => {
    const day = groupJobs(data({
      today: [job('first', 'confirmed', '2026-12-12T02:00:00Z'), job('second', 'pending', '2026-12-12T02:00:00Z')],
    }));
    expect(ids(day.today)).toEqual(['first', 'second']);
  });
  it('does not change the other groups', () => {
    const o = [job('o', 'pending', '2026-12-10T02:00:00Z')];
    const t = [job('t', 'pending', '2026-12-13T02:00:00Z')];
    const u = [{ dateKey: '2026-12-15', label: 'Tue, 15 Dec', jobs: [job('u', 'confirmed', '2026-12-15T02:00:00Z')] }];
    const r = groupJobs(data({ overdue: o, tomorrow: t, upcoming: u }));
    expect(r.overdue).toBe(o);
    expect(r.tomorrow).toBe(t);
    expect(r.upcoming).toBe(u);
  });
});

describe('groupJobs empty (change 15)', () => {
  it('is empty only when nothing at all is coming', () => {
    expect(groupJobs(data()).empty).toBe(true);
  });
  it('is not empty when only an upcoming day has a job', () => {
    const u = [{ dateKey: '2026-12-15', label: 'Tue, 15 Dec', jobs: [job('u', 'confirmed', '2026-12-15T02:00:00Z')] }];
    expect(groupJobs(data({ upcoming: u })).empty).toBe(false);
  });
  it('is not empty for an overdue job or a tomorrow job', () => {
    expect(groupJobs(data({ overdue: [job('o', 'pending', '2026-12-10T02:00:00Z')] })).empty).toBe(false);
    expect(groupJobs(data({ tomorrow: [job('t', 'pending', '2026-12-13T02:00:00Z')] })).empty).toBe(false);
  });
  it('still counts a day of only finished jobs as something to show', () => {
    const day = groupJobs(data({ today: [job('d', 'done', '2026-12-12T02:00:00Z')] }));
    expect(day.today).toEqual([]);
    expect(day.todayFinished).toHaveLength(1);
    expect(day.empty).toBe(false);
  });
});

describe('jobScreen (change 14)', () => {
  it('opens an in-progress job on the trip screen, wherever its card sits', () => {
    expect(jobScreen({ status: 'progress' })).toBe('trip');
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
