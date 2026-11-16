// The Notifications screen's rows: each one carries its words and an already
// checked link, so the row on screen trusts it and checks nothing again.

let mockRows: unknown[] = [];
jest.mock('../../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({ limit: async () => ({ data: mockRows, error: null }) }),
      }),
    }),
  },
}));

import { fetchNotifications } from '../notifications';

// Synthetic ids; this repo is public.
const row = (id: string, kind: string, payload: object) => ({
  id, kind, payload, enqueued_at: '2026-12-12T01:22:00Z', sent_at: null, read_at: null,
});

describe('fetchNotifications', () => {
  it('words each row and keeps its allowed link', async () => {
    mockRows = [row('n1', 'job_assigned', { job_number: 'JOB-047', pickup_location: 'KLIA', deeplink: '/jobs/JOB-047' })];
    const [item] = await fetchNotifications('24h');
    expect(item).toMatchObject({ id: 'n1', title: 'New job', jobNumber: 'JOB-047', body: 'KLIA', link: '/jobs/JOB-047', readAt: null });
  });

  it('gives a row with a refused link no link', async () => {
    mockRows = [row('n2', 'job_updated', { deeplink: '/admin/secret' })];
    const [item] = await fetchNotifications('24h');
    expect(item.link).toBeNull();
  });
});
