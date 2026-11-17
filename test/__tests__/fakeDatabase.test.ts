// The shared helper, exercised on its own: a fresh story per test, edits that
// do not leak, a fixed "today", and the failure rule. The moved query and
// screen tests use it the same way.

jest.mock('../../lib/supabase', () => require('../fakeDatabase').supabaseModule);

import { supabase } from '../../lib/supabase';
import { malaysiaDateKey } from '../../demo/fixtures';
import { installFakeDatabase } from '../fakeDatabase';

describe('installFakeDatabase (real today)', () => {
  const fake = installFakeDatabase();

  it('answers reads from the story', async () => {
    const { data } = await supabase.from('jobs').select('*').eq('job_number', 'JOB-137').single();
    expect(data).toMatchObject({ client_name: 'Nusantara Weddings', status: 'in_progress' });
  });

  it('lets the test edit a row before the code under test reads it', async () => {
    fake.db.jobs.find(j => j.job_number === 'JOB-137')!.status = 'done';
    const { data } = await supabase.from('jobs').select('*').eq('job_number', 'JOB-137').single();
    expect(data).toMatchObject({ status: 'done' });
  });

  it('starts the next test from a fresh story, so the edit above is gone', async () => {
    const { data } = await supabase.from('jobs').select('*').eq('job_number', 'JOB-137').single();
    expect(data).toMatchObject({ status: 'in_progress' });
  });

  it('keeps today at the real Malaysia day', () => {
    expect(fake.db.todayKey).toBe(malaysiaDateKey(new Date()));
  });

  it('applies the failure rule to reads and commands, and clears it for the next test', async () => {
    fake.failWith(t => (t.kind === 'rpc' ? { message: 'boom' } : undefined));
    expect((await supabase.rpc('driver_my_vehicles')).error).toMatchObject({ message: 'boom' });
    expect((await supabase.from('jobs').select('*')).error).toBeNull();
  });

  it('starts with no failure rule', async () => {
    expect((await supabase.rpc('driver_my_vehicles')).error).toBeNull();
  });

  it('can be spied on, because the client is a plain object', async () => {
    const spy = jest.spyOn(supabase, 'from');
    await supabase.from('jobs').select('*');
    expect(spy).toHaveBeenCalledWith('jobs');
    spy.mockRestore();
  });
});

describe('installFakeDatabase with a fixed today', () => {
  const fake = installFakeDatabase({ now: new Date('2026-03-01T04:00:00Z') });

  it('moves the story onto that day', () => {
    expect(fake.db.todayKey).toBe('2026-03-01');
    const today = fake.db.jobs.find(j => j.job_number === 'JOB-137')!;
    expect(malaysiaDateKey(new Date(today.pickup_datetime))).toBe('2026-03-01');
  });
});
