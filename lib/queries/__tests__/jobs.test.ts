// The Jobs list query keeps the real pickup time and the dispatcher's status
// as sent, so the screen can order today's jobs and lib/jobStatus.ts can read it.
// supabase is mocked so importing the query builds no live client (AGENTS.md).
const mockResult = jest.fn();
const mockOr = jest.fn();
jest.mock('../../supabase', () => {
  const chain: any = {};
  for (const m of ['from', 'select', 'eq']) chain[m] = () => chain;
  chain.or = (expr: string) => { mockOr(expr); return chain; };
  chain.order = () => Promise.resolve(mockResult());
  return { supabase: chain };
});
jest.mock('../driverProfile', () => ({ fetchCommissionBaseline: () => Promise.resolve(null) }));

import { fetchJobs } from '../jobs';

const row = (id: string, status: string, pickup: string) => ({
  id: `asg-${id}`,
  vehicle: { plate_number: 'WXY 1234' },
  jobs: {
    id: `uuid-${id}`, job_number: id, pickup_datetime: pickup, pickup_location: 'A', dropoff_location: 'B',
    client_name: 'Client', pax: 2, status, commission_rate_override: null, commission_fixed_amount: null,
  },
});

describe('fetchJobs', () => {
  it('keeps the real pickup timestamp and the status as the dispatcher sent it', async () => {
    const pickup = new Date().toISOString();
    mockResult.mockReturnValue({ data: [row('J1', 'cancelled', pickup), row('J2', 'in_progress', pickup)], error: null });
    const jobs = await fetchJobs();
    expect(jobs.map((j) => [j.id, j.status, j.pickupAt])).toEqual([
      ['J1', 'cancelled', pickup],
      ['J2', 'in_progress', pickup],
    ]);
    expect(jobs[0]).not.toHaveProperty('rawStatus');
  });

  it('returns one flat list in download order, with raw times and no time text', async () => {
    // An overdue, a today, a tomorrow and a later-day job: the day split is the
    // screen's job now (lib/jobGroups.ts), so the download leaves them as one list.
    const pickups = ['2026-12-01T02:00:00Z', '2026-12-12T02:00:00Z', '2026-12-13T02:00:00Z', '2026-12-20T02:00:00Z'];
    mockResult.mockReturnValue({ data: pickups.map((p, i) => row(`J${i}`, 'confirmed', p)), error: null });
    const jobs = await fetchJobs();
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.map((j) => j.pickupAt)).toEqual(pickups);
    for (const j of jobs) {
      expect(j).not.toHaveProperty('time');
      expect(j).not.toHaveProperty('pickupDate');
    }
  });

  it('carries past jobs forward unless they are finished, so an unknown status is never dropped', async () => {
    mockResult.mockReturnValue({ data: [], error: null });
    await fetchJobs();
    const expr: string = mockOr.mock.calls[0][0];
    expect(expr).toContain('status.not.in.(done,rejected,cancelled)');
    expect(expr).not.toContain('status.in.(');
  });
});
