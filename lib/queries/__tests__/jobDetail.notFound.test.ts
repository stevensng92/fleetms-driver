// Redesign change 20: a job that has left the driver's list (cancelled,
// reassigned, or no longer visible to this driver) must read as "not found",
// not as a failure. A network error must still be a failure so the screen
// shows Retry. The two used to look the same: both threw.
//
// Same supabase-mock pattern as jobDetail.clientPhone.test.ts. `from()` hands
// out one canned answer per call, in the order the query makes them.

const mockFrom = jest.fn();

jest.mock('../../supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args), rpc: jest.fn() },
}));

import { fetchJobDetailByNumber } from '../jobDetail';

type Answer = { data: unknown; error: unknown };

/** A query builder whose every step returns itself and whose end resolves to `answer`. */
function builder(answer: Answer) {
  const b: any = {};
  for (const m of ['select', 'eq', 'order']) b[m] = () => b;
  b.single = () => Promise.resolve(answer);
  return b;
}

function answers(...list: Answer[]) {
  list.forEach(a => mockFrom.mockReturnValueOnce(builder(a)));
}

// What PostgREST sends when .single() matches no row.
const NO_ROW = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows' };
// What postgrest-js sends when the request never got out (status 0, no code).
const OFFLINE = { message: 'TypeError: Network request failed', details: '', hint: '', code: '' };

describe('fetchJobDetailByNumber', () => {
  beforeEach(() => mockFrom.mockReset());

  it('says "not found" (null) when no job has that number for this driver', async () => {
    answers({ data: null, error: NO_ROW });
    await expect(fetchJobDetailByNumber('JOB-404')).resolves.toBeNull();
  });

  it('says "not found" when the job exists but is no longer on this driver (the detail read finds no row)', async () => {
    answers({ data: { id: 'uuid-1' }, error: null }, { data: null, error: NO_ROW });
    await expect(fetchJobDetailByNumber('JOB-139')).resolves.toBeNull();
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('still throws on a network error, so the screen can offer Retry', async () => {
    answers({ data: null, error: OFFLINE });
    await expect(fetchJobDetailByNumber('JOB-137')).rejects.toBe(OFFLINE);
  });

  it('still throws on a network error in the detail read', async () => {
    answers({ data: { id: 'uuid-1' }, error: null }, { data: null, error: OFFLINE });
    await expect(fetchJobDetailByNumber('JOB-137')).rejects.toBe(OFFLINE);
  });

  it('still throws on any other server error (a missing column is a bug, not a missing job)', async () => {
    const missingColumn = { code: '42703', message: 'column jobs.nope does not exist' };
    answers({ data: null, error: missingColumn });
    await expect(fetchJobDetailByNumber('JOB-137')).rejects.toBe(missingColumn);
  });
});
