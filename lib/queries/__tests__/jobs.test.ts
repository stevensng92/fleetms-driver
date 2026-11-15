// The Jobs list query keeps the real pickup time and the raw status, so the
// screen can order today's jobs and a cancelled job can read "Cancelled".
// supabase is mocked so importing the query builds no live client (AGENTS.md).
const mockResult = jest.fn();
jest.mock('../../supabase', () => {
  const chain: any = {};
  for (const m of ['from', 'select', 'eq', 'or']) chain[m] = () => chain;
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
  it('keeps the real pickup timestamp and the raw status on each job', async () => {
    const pickup = new Date().toISOString(); // inside today's Malaysia day by construction
    mockResult.mockReturnValue({ data: [row('J1', 'cancelled', pickup), row('J2', 'in_progress', pickup)], error: null });
    const { today } = await fetchJobs();
    expect(today.map((j) => [j.id, j.status, j.rawStatus, j.pickupAt])).toEqual([
      ['J1', 'voided', 'cancelled', pickup],
      ['J2', 'progress', 'in_progress', pickup],
    ]);
  });
});
