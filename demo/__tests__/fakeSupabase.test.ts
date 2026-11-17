import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createFakeSupabase, supabaseConfigured } from '../fakeSupabase';
import { buildDb, malaysiaDateKey } from '../fixtures';

// The fake client is the only seam between the real screens and demo data, so
// these tests pin two things: the builder behaves like PostgREST for the filter
// shapes the app uses, and the real query hooks get rows their mappers accept.

// Fixed clock: 2026-11-15 12:00 Malaysia time. The mock's "today" (12 Dec 2026)
// maps onto this day, so every relative date is predictable.
const NOW = new Date('2026-11-15T04:00:00Z');

function fresh() {
  const db = buildDb(NOW);
  const client = createFakeSupabase({ db, now: () => NOW, search: () => '' });
  return { db, client };
}

// The hooks import '../supabase'. Swap it for a fake built on the fixed clock.
jest.mock('../../lib/supabase', () => {
  const { createFakeSupabase: make } = require('../fakeSupabase');
  const { buildDb: build } = require('../fixtures');
  const now = new Date(); // the hooks read the real clock
  return {
    supabase: make({ db: build(now), now: () => now, search: () => '' }),
    supabaseConfigured: true,
  };
});

describe('fixtures dates', () => {
  it('maps the mock day onto the real Malaysia day', () => {
    expect(malaysiaDateKey(NOW)).toBe('2026-11-15');
    expect(malaysiaDateKey(new Date('2026-11-14T17:00:00Z'))).toBe('2026-11-15'); // 01:00 MYT
  });
});

describe('query builder filters', () => {
  it('reports the client as configured', () => {
    expect(supabaseConfigured).toBe(true);
  });

  it('eq keeps matching rows only', async () => {
    const { client } = fresh();
    const { data, error } = await client.from('jobs').select('*').eq('status', 'done');
    expect(error).toBeNull();
    expect((data as any[]).length).toBeGreaterThan(0);
    expect((data as any[]).every(r => r.status === 'done')).toBe(true);
  });

  it('in keeps rows whose value is listed', async () => {
    const { client } = fresh();
    const { data } = await client.from('jobs').select('*').in('status', ['pending', 'cancelled']);
    const statuses = new Set((data as any[]).map(r => r.status));
    expect([...statuses].sort()).toEqual(['cancelled', 'pending']);
  });

  it('gte / lt compare timestamps by instant, not by text', async () => {
    const { client } = fresh();
    const start = '2026-11-14T16:00:00.000Z'; // MY midnight of 15 Nov
    const end = '2026-11-15T16:00:00.000Z';
    const { data } = await client.from('jobs').select('*').gte('pickup_datetime', start).lt('pickup_datetime', end);
    const rows = data as any[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(Date.parse(r.pickup_datetime)).toBeGreaterThanOrEqual(Date.parse(start));
      expect(Date.parse(r.pickup_datetime)).toBeLessThan(Date.parse(end));
    }
  });

  it('gt / lte are exclusive / inclusive', async () => {
    const { client } = fresh();
    const { data: all } = await client.from('expenses').select('*');
    const max = Math.max(...(all as any[]).map(r => r.amount));
    const gt = await client.from('expenses').select('*').gt('amount', max);
    const lte = await client.from('expenses').select('*').lte('amount', max);
    expect(gt.data).toEqual([]);
    expect((lte.data as any[]).length).toBe((all as any[]).length);
  });

  it('dotted path filters an embedded array and drops parents left empty', async () => {
    const { client } = fresh();
    const keep = await client.from('jobs').select('*').eq('assignments.is_current', true);
    expect((keep.data as any[]).length).toBeGreaterThan(0);
    const none = await client.from('jobs').select('*').eq('assignments.is_current', false);
    expect(none.data).toEqual([]);
  });

  it('dotted path also works against an embedded object', async () => {
    const { client } = fresh();
    const { data } = await client.from('assignments').select('*').eq('jobs.status', 'in_progress');
    expect((data as any[]).map(r => r.jobs.job_number)).toEqual(['JOB-137']);
  });

  it('or() on an embedded table nulls the embed that fails and keeps the parent', async () => {
    const { client } = fresh();
    const base = await client.from('assignments').select('*');
    const withOr = await client.from('assignments').select('*').or(
      'and(pickup_datetime.gte.2026-11-14T16:00:00.000Z,pickup_datetime.lt.2026-11-15T16:00:00.000Z),' +
      'and(pickup_datetime.lt.2026-11-14T16:00:00.000Z,status.in.(pending,confirmed))',
      { foreignTable: 'jobs' },
    );
    const rows = withOr.data as any[];
    expect(rows.length).toBe((base.data as any[]).length);
    const visible = rows.filter(r => r.jobs).map(r => r.jobs.job_number);
    expect(visible).toContain('JOB-139');                 // overdue and still open
    expect(visible).toContain('JOB-137');                 // today
    expect(visible).not.toContain('JOB-088');             // old and done
    expect(visible).not.toContain('JOB-132');             // tomorrow: outside this made-up window
  });

  it('or() on the table itself filters rows', async () => {
    const { client } = fresh();
    const { data } = await client.from('jobs').select('*').or('status.eq.done,status.eq.cancelled');
    expect((data as any[]).every(r => ['done', 'cancelled'].includes(r.status))).toBe(true);
  });

  it('order sorts ascending / descending and limit trims', async () => {
    const { client } = fresh();
    const asc = await client.from('jobs').select('*').order('pickup_datetime', { ascending: true }).limit(3);
    const rows = asc.data as any[];
    expect(rows).toHaveLength(3);
    expect(Date.parse(rows[0].pickup_datetime)).toBeLessThanOrEqual(Date.parse(rows[1].pickup_datetime));
    const desc = await client.from('jobs').select('*').order('pickup_datetime', { ascending: false }).limit(1);
    const everyone = (await client.from('jobs').select('*')).data as any[];
    const latest = Math.max(...everyone.map(r => Date.parse(r.pickup_datetime)));
    expect(Date.parse((desc.data as any[])[0].pickup_datetime)).toBe(latest);
  });

  it('count: exact reports the size before limit', async () => {
    const { client } = fresh();
    const { data, count } = await client.from('jobs').select('*', { count: 'exact' }).limit(2);
    expect((data as any[]).length).toBe(2);
    expect(count).toBeGreaterThan(2);
  });

  it('range keeps the asked window', async () => {
    const { client } = fresh();
    const { data } = await client.from('jobs').select('*').order('pickup_datetime', { ascending: true }).range(1, 2);
    expect((data as any[]).length).toBe(2);
  });

  it('single returns the first match, and a PostgREST style error on none', async () => {
    const { client } = fresh();
    const ok = await client.from('jobs').select('id').eq('job_number', 'JOB-138').single();
    expect(ok.error).toBeNull();
    expect((ok.data as any).id).toBeTruthy();
    const none = await client.from('jobs').select('id').eq('job_number', 'NOPE').single();
    expect(none.data).toBeNull();
    expect(none.error?.code).toBe('PGRST116');
  });

  it('maybeSingle returns null without an error on none', async () => {
    const { client } = fresh();
    const none = await client.from('jobs').select('id').eq('job_number', 'NOPE').maybeSingle();
    expect(none).toMatchObject({ data: null, error: null });
  });

  it('returns copies, so a caller cannot corrupt the fixtures', async () => {
    const { client } = fresh();
    const a = await client.from('jobs').select('*').eq('job_number', 'JOB-138').single();
    (a.data as any).status = 'hacked';
    const b = await client.from('jobs').select('*').eq('job_number', 'JOB-138').single();
    expect((b.data as any).status).toBe('pending');
  });

  it('an unknown table is an error, not a crash', async () => {
    const { client } = fresh();
    const r = await client.from('nope').select('*');
    expect(r.error).toBeTruthy();
  });
});

describe('auth, storage and realtime stubs', () => {
  it('has a session and signs out and in again', async () => {
    const { client } = fresh();
    expect((await client.auth.getSession()).data.session).toBeTruthy();
    await client.auth.signOut();
    expect((await client.auth.getSession()).data.session).toBeNull();
    const r = await client.auth.signInWithPassword({ email: 'x@y.z', password: '000000' });
    expect(r.error).toBeNull();
    expect((await client.auth.getSession()).data.session).toBeTruthy();
  });

  it('subscribes and unsubscribes to auth changes', () => {
    const { client } = fresh();
    const { data } = client.auth.onAuthStateChange(() => {});
    expect(() => data.subscription.unsubscribe()).not.toThrow();
  });

  it('chains channel().on().subscribe() and removes it', async () => {
    const { client } = fresh();
    const ch = client.channel('driver-jobs-1').on('postgres_changes', {}, () => {}).subscribe();
    expect(ch.topic).toBe('realtime:driver-jobs-1');
    expect(client.getChannels()).toContain(ch);
    await client.removeChannel(ch);
    expect(client.getChannels()).toEqual([]);
  });

  it('signs a receipt url and accepts an upload', async () => {
    const { client } = fresh();
    const signed = await client.storage.from('expense_receipts').createSignedUrl('a/b.jpg', 600);
    expect(signed.data?.signedUrl).toMatch(/^data:image\/svg\+xml/);
    const up = await client.storage.from('expense_receipts').upload('a/b.jpg', new Uint8Array(1), {});
    expect(up.error).toBeNull();
  });
});

describe('rpc', () => {
  it('unknown rpc resolves to null data and no error', async () => {
    const { client } = fresh();
    expect(await client.rpc('report_driver_app_version', { p_app_version: '0.11.0' })).toMatchObject({ data: null, error: null });
  });

  it('driver_start_job then driver_complete_job move the job through its states and record pay', async () => {
    const { client, db } = fresh();
    const job = db.jobs.find(j => j.job_number === 'JOB-140')!;
    await client.rpc('driver_start_job', { target_job_id: job.id });
    expect(job.status).toBe('in_progress');
    await client.rpc('driver_complete_job', { target_job_id: job.id });
    expect(job.status).toBe('done');
    expect(job.commission_amount).toBeGreaterThan(0);
  });

  it('driver_confirm_assignment confirms the job', async () => {
    const { client, db } = fresh();
    const asg = db.assignments.find(a => a.id === 'asg-138')!;
    await client.rpc('driver_confirm_assignment', { target_assignment_id: asg.id });
    expect(db.jobs.find(j => j.id === asg.job_id)!.status).toBe('confirmed');
  });

  it('driver_reject_assignment takes the job off the list', async () => {
    const { client } = fresh();
    await client.rpc('driver_reject_assignment', { target_assignment_id: 'asg-141', reject_reason: null });
    const { data } = await client.from('assignments').select('*').eq('is_current', true);
    expect((data as any[]).some(r => r.id === 'asg-141')).toBe(false);
  });

  it('a completed overdue job leaves the list once the apps own or() filter runs', async () => {
    const { client, db } = fresh();
    const list = async () => {
      const r = await client.from('assignments').select('*').eq('is_current', true).or(
        'and(pickup_datetime.gte.2026-11-14T16:00:00.000Z,pickup_datetime.lt.2026-11-30T16:00:00.000Z),' +
        'and(pickup_datetime.gte.2026-10-15T16:00:00.000Z,pickup_datetime.lt.2026-11-14T16:00:00.000Z,status.in.(pending,confirmed,in_progress))',
        { foreignTable: 'jobs' },
      );
      return (r.data as any[]).filter(x => x.jobs).map(x => x.jobs.job_number);
    };
    expect(await list()).toContain('JOB-139');
    await client.rpc('driver_complete_job', { target_job_id: db.jobs.find(j => j.job_number === 'JOB-139')!.id });
    expect(await list()).not.toContain('JOB-139');
  });

  it('honours status.not.in: a past job with an unknown status stays, a cancelled one leaves', async () => {
    const { client, db } = fresh();
    const list = async () => {
      const r = await client.from('assignments').select('*').eq('is_current', true).or(
        'and(pickup_datetime.gte.2026-11-14T16:00:00.000Z,pickup_datetime.lt.2026-11-30T16:00:00.000Z),' +
        'and(pickup_datetime.gte.2026-10-15T16:00:00.000Z,pickup_datetime.lt.2026-11-14T16:00:00.000Z,status.not.in.(done,rejected,cancelled))',
        { foreignTable: 'jobs' },
      );
      return (r.data as any[]).filter(x => x.jobs).map(x => x.jobs.job_number);
    };
    const j139 = db.jobs.find(j => j.job_number === 'JOB-139')!;
    (j139 as any).status = 'on_hold';
    expect(await list()).toContain('JOB-139');
    (j139 as any).status = 'cancelled';
    expect(await list()).not.toContain('JOB-139');
  });

  it('driver_log_expense adds a pending expense and returns its id', async () => {
    const { client } = fresh();
    const { data: id } = await client.rpc('driver_log_expense', {
      p_category: 'fuel', p_amount: 50, p_expense_date: '2026-11-15', p_vehicle_id: 'v-alphard', p_notes: 'demo', p_receipt_path: null,
    });
    const row = await client.from('expenses').select('*').eq('id', id as string).single();
    expect(row.data).toMatchObject({ status: 'pending', amount: 50, category: 'fuel' });
    expect((row.data as any).vehicle.plate_number).toBe('VKA 2231');
  });

  it('request / cancel time off updates the list', async () => {
    const { client } = fresh();
    const { data: id } = await client.rpc('request_driver_time_off', {
      p_starts_at: '2026-11-20T16:00:00.000Z', p_ends_at: '2026-11-21T16:00:00.000Z', p_reason: 'leave', p_notes: null,
    });
    let rows = (await client.from('driver_time_off').select('*')).data as any[];
    expect(rows.find(r => r.id === id)).toMatchObject({ status: 'pending', reason: 'leave' });
    await client.rpc('cancel_driver_time_off', { p_id: id });
    rows = (await client.from('driver_time_off').select('*')).data as any[];
    expect(rows.some(r => r.id === id)).toBe(false);
  });

  it('mark_notifications_read stamps read_at and returns the count', async () => {
    const { client } = fresh();
    const { data: n } = await client.rpc('mark_notifications_read', { p_ids: ['n6', 'n5'] });
    expect(n).toBe(2);
    const row = await client.from('push_log').select('*').eq('id', 'n6').single();
    expect((row.data as any).read_at).toBeTruthy();
  });

  it('driver_job_client_phone answers with the billing client number', async () => {
    const { client, db } = fresh();
    const job = db.jobs.find(j => j.job_number === 'JOB-140')!;
    const { data } = await client.rpc('driver_job_client_phone', { target_job_id: job.id });
    expect(data).toBe('+60 3-9212 4400');
  });

  it('driver_my_vehicles lists the org cars with a default', async () => {
    const { client } = fresh();
    const { data } = await client.rpc('driver_my_vehicles');
    expect((data as any[]).filter(v => v.is_default)).toHaveLength(1);
  });
});

describe('app version config', () => {
  const cfg = async (search: string) => {
    const c = createFakeSupabase({ db: buildDb(NOW), now: () => NOW, search: () => search });
    return (await c.from('driver_app_version_config').select('*').eq('id', true).single()).data as any;
  };
  it('is ok by default', async () => {
    const c = await cfg('');
    expect(c.minimum_version).toBe('0.1.0');
    expect(c.recommended_version).toBe('0.11.0');
  });
  it('asks for an update with ?version=required', async () => {
    expect((await cfg('?version=required')).minimum_version).toBe('99.0.0');
  });
  it('nags softly with ?version=recommended', async () => {
    const c = await cfg('?version=recommended');
    expect(c.recommended_version).toBe('99.0.0');
    expect(c.minimum_version).toBe('0.1.0');
  });
});

describe('real query hooks over the fake client', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children);

  async function run<T>(hook: () => { data?: T; isError: boolean; error?: unknown }) {
    const { result } = await renderHook(hook, { wrapper });
    await waitFor(() => expect(result.current.data !== undefined || result.current.isError).toBe(true), { timeout: 4000 });
    expect(result.current.isError).toBe(false);
    return result.current.data as T;
  }

  it('session gate profile is signed in with a PIN set', async () => {
    const { fetchDriverProfile } = require('../../lib/auth');
    const r = await fetchDriverProfile();
    expect(r).toMatchObject({ kind: 'ok', profile: { pinSet: true } });
  });

  it('driver profile names Azman, his org and car', async () => {
    const { useDriverProfile } = require('../../lib/queries/driverProfile');
    const p: any = await run(() => useDriverProfile());
    expect(p).toMatchObject({ name: 'Azman bin Yusof', initials: 'AB', org: { name: 'Continental Travel' }, availability: 'on_job' });
    expect(p.vehicle.plate).toBe('VKA 2231');
  });

  it('jobs land in overdue / today / tomorrow / upcoming', async () => {
    // The download is one flat list; the Jobs tab splits it by Malaysian day on screen.
    const { useTodaysJobs } = require('../../lib/queries/jobs');
    const { groupJobs } = require('../../lib/jobGroups');
    const j: any = groupJobs(await run(() => useTodaysJobs()));
    expect(j.overdue.map((x: any) => x.id)).toEqual(['JOB-139']);
    expect([...j.today, ...j.todayFinished].map((x: any) => x.id)).toEqual(['JOB-137', 'JOB-138', 'JOB-140', 'JOB-124', 'JOB-144']);
    expect(j.tomorrow.map((x: any) => x.id)).toEqual(['JOB-132', 'JOB-141']);
    expect(j.upcoming.flatMap((g: any) => g.jobs.map((x: any) => x.id))).toEqual(['JOB-142', 'JOB-143']);
    const j137 = j.today.find((x: any) => x.id === 'JOB-137');
    expect(j137.vehicle).toBe('VKA 2231');
    expect(j137.specialCommission).toEqual({ kind: 'fixed', amount: 80 });
  });

  it('job detail carries stops, surcharges, contact and the assignment', async () => {
    const { useJobDetailByNumber } = require('../../lib/queries/jobDetail');
    const d: any = await run(() => useJobDetailByNumber('JOB-137'));
    expect(d).not.toHaveProperty('rawStatus');
    expect(d).toMatchObject({ jobNumber: 'JOB-137', status: 'in_progress', client: 'Nusantara Weddings', vehiclePlate: 'VKA 2231' });
    expect(d.stops.map((s: any) => s.kind)).toEqual(['Pickup', 'Stop 1', 'Dropoff']);
    expect(d.surcharges[0]).toMatchObject({ name: 'Decoration', amount: 50, treatment: 'pass_through' });
    expect(d.contact.source).toBe('passenger');
  });

  it('job detail falls back to the client number when the passenger has none', async () => {
    const { useJobDetailByNumber } = require('../../lib/queries/jobDetail');
    const d: any = await run(() => useJobDetailByNumber('JOB-140'));
    expect(d.contact).toEqual({ phone: '+60 3-9212 4400', source: 'client' });
  });

  it('earnings read the done jobs with commissions', async () => {
    const { useDriverEarnings } = require('../../lib/queries/earnings');
    const e: any = await run(() => useDriverEarnings('all'));
    expect(e.jobsCount).toBeGreaterThan(5);
    expect(e.commissionTotal).toBeGreaterThan(0);
    expect(e.missingCommissionCount).toBe(1);
  });

  it('earnings history starts at the oldest done job', async () => {
    const { useEarningsHistoryStart } = require('../../lib/queries/earnings');
    const s = await run(() => useEarningsHistoryStart());
    expect(typeof s).toBe('string');
  });

  it('expenses list this month with a plate and a status', async () => {
    const { useMyExpenses } = require('../../lib/queries/expenses');
    const x: any = await run(() => useMyExpenses());
    expect(x.rows.length).toBeGreaterThan(2);
    expect(x.rows[0]).toMatchObject({ vehiclePlate: 'VKA 2231' });
    expect(x.total).toBeGreaterThan(0);
  });

  it('notifications render a title and an unread count', async () => {
    const { useNotifications } = require('../../lib/queries/notifications');
    const n: any = await run(() => useNotifications());
    expect(n.length).toBe(6);
    // The download holds raw details; the words are built when the row draws.
    expect(n[0]).toMatchObject({ kind: 'job_assigned', jobNumber: 'JOB-143' });
    expect(require('../../lib/notification').notificationWords(n[0]).title).toBe('New job');
    expect(n.filter((i: any) => i.readAt === null)).toHaveLength(2);
  });

  it('time off lists soonest first', async () => {
    const { useDriverTimeOff } = require('../../lib/queries/timeOff');
    const t: any = await run(() => useDriverTimeOff());
    expect(t.map((x: any) => x.status)).toEqual(['approved', 'pending']);
  });

  it('vehicles come through the rpc mapper', async () => {
    const { useMyVehicles } = require('../../lib/queries/vehicles');
    const v: any = await run(() => useMyVehicles());
    expect(v[0]).toMatchObject({ plateNumber: 'VKA 2231', isDefault: true });
  });

  it('receipt signed url resolves', async () => {
    const { getSignedReceiptUrl } = require('../../lib/queries/expenses');
    expect(await getSignedReceiptUrl('demo/x1.svg')).toMatch(/^data:/);
  });
});
