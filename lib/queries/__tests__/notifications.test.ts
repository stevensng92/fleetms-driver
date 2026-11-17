// The Notifications screen's rows: each one carries its raw details and an
// already checked link, so the row on screen trusts it and checks nothing
// again. The words are built on screen (lib/notification.ts).
// Runs on the demo's fake database (test/fakeDatabase.ts).
jest.mock('../../supabase', () => require('../../../test/fakeDatabase').supabaseModule);

import { supabase } from '../../supabase';
import { fetchNotifications } from '../notifications';
import { installFakeDatabase } from '../../../test/fakeDatabase';

const fake = installFakeDatabase();

describe('fetchNotifications', () => {
  it("keeps each row's raw details and its allowed link, with no formatted text", async () => {
    const [item] = await fetchNotifications();
    const stored = fake.db.pushLog.find(r => r.id === 'n6')!;
    const job = fake.db.jobs.find(j => j.job_number === 'JOB-143')!;
    expect(item).toEqual({
      id: 'n6', kind: 'job_assigned', enqueuedAt: stored.enqueued_at, sentAt: stored.sent_at, readAt: null,
      jobNumber: 'JOB-143', clientName: 'Apex Events', pickupLocation: job.pickup_location, pickupAt: job.pickup_datetime,
      link: '/jobs/JOB-143',
    });
  });

  it('lists newest first', async () => {
    expect((await fetchNotifications()).map(n => n.id)).toEqual(['n6', 'n5', 'n4', 'n3', 'n2', 'n1']);
  });

  it('gives a row with a refused link no link', async () => {
    (fake.db.pushLog.find(r => r.id === 'n6')!.payload as any).deeplink = '/admin/secret';
    const [item] = await fetchNotifications();
    expect(item.link).toBeNull();
  });

  // Value: protects=a failed load reaches the screen as an error, not as "no notifications"; fails_when=the error is swallowed or data null becomes a crash; why_new=extracted function, no test of its error or empty-data exits; seam=none; no_claim=React Query's retry UI
  it('throws when the load fails', async () => {
    fake.failWith(t => (t.name === 'push_log' ? { message: 'offline' } : undefined));
    await expect(fetchNotifications()).rejects.toMatchObject({ message: 'offline' });
  });

  it('gives an empty list for no rows', async () => {
    fake.db.pushLog.length = 0;
    expect(await fetchNotifications()).toEqual([]);
  });

  it('gives an empty list when the answer carries no data and no error', async () => {
    // The fake always answers with an array; this one-off stand-in keeps the `?? []` guard checked.
    const spy = jest.spyOn(supabase, 'from').mockReturnValue({
      select: () => ({ order: () => ({ limit: async () => ({ data: null, error: null }) }) }),
    } as any);
    expect(await fetchNotifications()).toEqual([]);
    spy.mockRestore();
  });
});
