// The Jobs list query keeps the real pickup time and the dispatcher's status
// as sent, so the screen can order today's jobs and lib/jobStatus.ts can read it.
// Runs on the demo's fake database (test/fakeDatabase.ts), so the rows are the
// shared story and the fake applies the query's own filters.
jest.mock('../../supabase', () => require('../../../test/fakeDatabase').supabaseModule);

import { fetchJobs } from '../jobs';
import { myStartOfDay } from '../../timeFormat';
import { installFakeDatabase } from '../../../test/fakeDatabase';

const fake = installFakeDatabase();

const jobRow = (number: string) => fake.db.jobs.find(j => j.job_number === number)!;
const numbers = async () => (await fetchJobs()).map(j => j.id);

describe('fetchJobs', () => {
  it('keeps the real pickup timestamp and the status as the dispatcher sent it', async () => {
    const jobs = await fetchJobs();
    const cancelled = jobs.find(j => j.id === 'JOB-144')!;
    const inProgress = jobs.find(j => j.id === 'JOB-137')!;
    expect([cancelled.status, cancelled.pickupAt]).toEqual(['cancelled', jobRow('JOB-144').pickup_datetime]);
    expect([inProgress.status, inProgress.pickupAt]).toEqual(['in_progress', jobRow('JOB-137').pickup_datetime]);
    expect(cancelled).not.toHaveProperty('rawStatus');
  });

  it('returns one flat list in download order, with raw times and no time text', async () => {
    // An overdue, several today, a tomorrow and later-day jobs: the day split is
    // the screen's job now (lib/jobGroups.ts), so the download leaves them as one list.
    const jobs = await fetchJobs();
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs[0].id).toBe('JOB-139'); // the overdue one
    expect(jobs[jobs.length - 1].id).toBe('JOB-143'); // the furthest day
    for (const j of jobs) {
      expect(j).not.toHaveProperty('time');
      expect(j).not.toHaveProperty('pickupDate');
    }
  });

  // Value: protects=fetchJobs returns jobs oldest pickup first even though the database orders only inside each embedded job; fails_when=the final sort is removed and rows come back in assignment order; why_new=the flat-list test feeds rows already in pickup order; seam=none; no_claim=the live PostgREST row order (the fake keeps assignment order)
  it('puts jobs in pickup order when the rows arrive out of order, keeping equal times in download order', async () => {
    fake.db.assignments.reverse(); // rows now arrive latest first
    jobRow('JOB-140').pickup_datetime = jobRow('JOB-138').pickup_datetime; // a tie; JOB-140 now arrives first
    expect(await numbers()).toEqual([
      'JOB-139', 'JOB-124', 'JOB-137', 'JOB-140', 'JOB-138', 'JOB-144', 'JOB-132', 'JOB-141', 'JOB-142', 'JOB-143',
    ]);
  });

  describe('carries past jobs forward unless they are finished, so an unknown status is never dropped', () => {
    it.each(['pending', 'confirmed', 'in_progress', 'a_status_added_next_year'])('keeps an overdue %s job', async status => {
      jobRow('JOB-139').status = status as any;
      expect(await numbers()).toContain('JOB-139');
    });

    it.each(['done', 'rejected', 'cancelled'])('drops an overdue %s job', async status => {
      jobRow('JOB-139').status = status as any;
      expect(await numbers()).not.toContain('JOB-139');
    });

    it('drops an open job whose pickup is more than 30 days back', async () => {
      jobRow('JOB-139').pickup_datetime = myStartOfDay(new Date(), -31).toISOString();
      expect(await numbers()).not.toContain('JOB-139');
    });

    it('drops a job more than two weeks past tomorrow, at any status', async () => {
      jobRow('JOB-143').pickup_datetime = myStartOfDay(new Date(), 17).toISOString();
      expect(await numbers()).not.toContain('JOB-143');
    });
  });

  it('throws the database error when the download fails, so the screen can offer Retry', async () => {
    const offline = { message: 'TypeError: Network request failed', code: '', details: '', hint: '' };
    fake.failWith(t => (t.name === 'assignments' ? offline : undefined));
    await expect(fetchJobs()).rejects.toBe(offline);
  });
});
