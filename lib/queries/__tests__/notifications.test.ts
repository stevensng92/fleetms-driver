// The Notifications screen's rows: each one carries its raw details and an
// already checked link, so the row on screen trusts it and checks nothing
// again. The words are built on screen (lib/notification.ts).

let mockRows: unknown[] | null = [];
let mockError: unknown = null;
jest.mock('../../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({ limit: async () => ({ data: mockRows, error: mockError }) }),
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
  it("keeps each row's raw details and its allowed link, with no formatted text", async () => {
    mockRows = [row('n1', 'job_assigned', {
      job_number: 'JOB-047', client_name: 'Acme', pickup_location: 'KLIA', pickup_datetime: '2026-12-12T01:22:00Z', deeplink: '/jobs/JOB-047',
    })];
    const [item] = await fetchNotifications();
    expect(item).toEqual({
      id: 'n1', kind: 'job_assigned', enqueuedAt: '2026-12-12T01:22:00Z', sentAt: null, readAt: null,
      jobNumber: 'JOB-047', clientName: 'Acme', pickupLocation: 'KLIA', pickupAt: '2026-12-12T01:22:00Z', link: '/jobs/JOB-047',
    });
  });

  it('gives a row with a refused link no link', async () => {
    mockRows = [row('n2', 'job_updated', { deeplink: '/admin/secret' })];
    const [item] = await fetchNotifications();
    expect(item.link).toBeNull();
  });

  // Value: protects=a failed load reaches the screen as an error, not as "no notifications"; fails_when=the error is swallowed or data null becomes a crash; why_new=extracted function, no test of its error or empty-data exits; seam=none; no_claim=React Query's retry UI
  it('throws when the load fails, and gives an empty list for no data', async () => {
    mockError = new Error('offline');
    await expect(fetchNotifications()).rejects.toThrow('offline');
    mockError = null;
    mockRows = null;
    expect(await fetchNotifications()).toEqual([]);
  });
});
