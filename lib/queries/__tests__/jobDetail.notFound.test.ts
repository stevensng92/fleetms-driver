// Redesign change 20: a job that has left the driver's list (cancelled,
// reassigned, or no longer visible to this driver) must read as "not found",
// not as a failure. A network error must still be a failure so the screen
// shows Retry. The two used to look the same: both threw.
//
// Runs on the demo's fake database (test/fakeDatabase.ts). "No longer on this
// driver" is a story edit; the errors come from the fake's `fail` rule.
jest.mock('../../supabase', () => require('../../../test/fakeDatabase').supabaseModule);

import { supabase } from '../../supabase';
import { fetchJobDetailByNumber } from '../jobDetail';
import { installFakeDatabase } from '../../../test/fakeDatabase';

const fake = installFakeDatabase();

// What postgrest-js sends when the request never got out (status 0, no code).
const OFFLINE = { message: 'TypeError: Network request failed', details: '', hint: '', code: '' };

describe('fetchJobDetailByNumber', () => {
  it('returns the job with its stops when it is on this driver', async () => {
    const detail = await fetchJobDetailByNumber('JOB-137');
    expect(detail).toMatchObject({ jobNumber: 'JOB-137', client: 'Nusantara Weddings', status: 'in_progress' });
    expect(detail!.stops[0].kind).toBe('Pickup');
    expect(detail!.stops[detail!.stops.length - 1].kind).toBe('Dropoff');
  });

  it('says "not found" (null) when no job has that number for this driver', async () => {
    await expect(fetchJobDetailByNumber('JOB-404')).resolves.toBeNull();
  });

  it('says "not found" when the job exists but is no longer on this driver (the detail read finds no row)', async () => {
    // Reassigned away: the number still resolves, the detail read finds nothing.
    for (const a of fake.db.assignments.filter(x => x.job_id === fake.db.jobs.find(j => j.job_number === 'JOB-139')!.id)) {
      a.is_current = false;
    }
    const from = jest.spyOn(supabase, 'from');
    await expect(fetchJobDetailByNumber('JOB-139')).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(2);
    from.mockRestore();
  });

  it('still throws on a network error, so the screen can offer Retry', async () => {
    fake.failWith(() => OFFLINE);
    await expect(fetchJobDetailByNumber('JOB-137')).rejects.toBe(OFFLINE);
  });

  it('still throws on a network error in the detail read', async () => {
    let jobReads = 0;
    fake.failWith(t => (t.name === 'jobs' && ++jobReads === 2 ? OFFLINE : undefined));
    await expect(fetchJobDetailByNumber('JOB-137')).rejects.toBe(OFFLINE);
  });

  it('still throws on any other server error (a missing column is a bug, not a missing job)', async () => {
    const missingColumn = { message: 'column jobs.nope does not exist', code: '42703' };
    fake.failWith(() => missingColumn);
    await expect(fetchJobDetailByNumber('JOB-137')).rejects.toBe(missingColumn);
  });
});
