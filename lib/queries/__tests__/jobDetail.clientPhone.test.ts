// Worked example of a query test on the demo's fake database
// (test/fakeDatabase.ts). AGENTS.md notes that anything importing
// lib/supabase.ts builds a live client at import time; mocking that module is
// the way around it, and the helper does the mocking with one line.
//
// Worth having despite being three lines of function: fetchClientPhone's whole
// job is to FAIL QUIETLY. If it ever starts throwing, the job detail screen
// dies on jobs that have no client phone, which is most of them. That is the
// exact failure a passing type-check cannot see.
//
// Normal answers come from the story. Errors come from the fake's `fail` rule.
// The two checks about what the CLIENT does (it rejects, it throws) cannot be
// made by a fake that always answers, so they spy on the fake client's rpc.
jest.mock('../../supabase', () => require('../../../test/fakeDatabase').supabaseModule);

import { supabase } from '../../supabase';
import { fetchClientPhone } from '../jobDetail';
import { captureException } from '@sentry/react-native';
import { installFakeDatabase } from '../../../test/fakeDatabase';

const fake = installFakeDatabase();

// JOB-132 is Mr Tan's job in the story; his phone is on the client row.
const jobId = () => fake.db.jobs.find(j => j.job_number === 'JOB-132')!.id;
const TAN_PHONE = '+60 12-337 9021';
// A job id nothing in the story has. Synthetic: this repo is public.
const UNKNOWN_JOB = '00000000-0000-4000-8000-0000000009ff';

const spies: jest.SpyInstance[] = [];
const spyOnRpc = () => { const s = jest.spyOn(supabase, 'rpc'); spies.push(s); return s; };

describe('fetchClientPhone', () => {
  beforeEach(() => (captureException as jest.Mock).mockClear());
  afterEach(() => spies.splice(0).forEach(s => s.mockRestore()));

  it('passes the job id under the parameter name the RPC declares', async () => {
    // The SQL signature is driver_job_client_phone(target_job_id uuid). A
    // renamed key here fails at runtime with a PostgREST 404 that looks like
    // "function does not exist" — nothing type-checks this boundary.
    const rpc = spyOnRpc();
    await fetchClientPhone(jobId());
    expect(rpc).toHaveBeenCalledWith('driver_job_client_phone', { target_job_id: jobId() });
  });

  it('returns the number the RPC resolved', async () => {
    await expect(fetchClientPhone(jobId())).resolves.toBe(TAN_PHONE);
  });

  it('returns null when the caller is not entitled to a number', async () => {
    // The RPC answers NULL rather than raising for every denial: not assigned,
    // deactivated driver, wrong org, no client on the job.
    await expect(fetchClientPhone(UNKNOWN_JOB)).resolves.toBeNull();
  });

  it('degrades to null and reports when the RPC returns an error', async () => {
    // The shape that matters: dispatcher-side migration not applied yet, so
    // the function does not exist. The screen must still render with the
    // passenger number alone.
    fake.failWith(t => (t.kind === 'rpc'
      ? { message: 'function does not exist', code: 'PGRST202', details: '', hint: '', status: 404 }
      : undefined));
    await expect(fetchClientPhone(jobId())).resolves.toBeNull();
    expect(captureException).toHaveBeenCalled();
  });

  it('reports a server error as a real Error naming the RPC', async () => {
    // Regression: FLEETMS-DRIVER-6. The raw PostgrestError (a plain object)
    // reached Sentry as "Object captured as exception with keys: code,
    // details, hint, message" — no message, no call site.
    fake.failWith(() => ({ message: 'permission denied for function', code: '42501', details: 'd', hint: 'h', status: 403 }));
    await fetchClientPhone(jobId());
    const [reported, context] = (captureException as jest.Mock).mock.calls[0];
    expect(reported).toBeInstanceOf(Error);
    expect(reported.message).toBe('driver_job_client_phone failed: permission denied for function');
    expect(context).toEqual({ extra: { code: '42501', details: 'd', hint: 'h', status: 403 } });
  });

  it('degrades to null WITHOUT reporting when the request never reached the server', async () => {
    // postgrest-js resolves (not rejects) a failed fetch as status 0 with
    // "TypeError: Network request failed". A driver in a dead spot is not a
    // bug — reporting it opens a Sentry issue per coverage gap.
    fake.failWith(() => ({ message: 'TypeError: Network request failed', code: '', details: '', hint: '', status: 0 }));
    const rpc = spyOnRpc();
    await expect(fetchClientPhone(jobId())).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledTimes(2); // still retried once first
    expect(captureException).not.toHaveBeenCalled();
  });

  it('tries once more, so one dropped request still gives the number', async () => {
    let calls = 0;
    fake.failWith(t => (t.kind === 'rpc' && ++calls === 1
      ? { message: 'TypeError: Network request failed', code: '', details: '', hint: '', status: 0 }
      : undefined));
    await expect(fetchClientPhone(jobId())).resolves.toBe(TAN_PHONE);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('degrades to null when the call rejects outright', async () => {
    // Offline, or the fetch itself throws before PostgREST answers.
    spyOnRpc().mockRejectedValue(new Error('Network request failed'));
    await expect(fetchClientPhone(jobId())).resolves.toBeNull();
    expect(captureException).toHaveBeenCalled();
  });

  it('never throws, whatever the client does', async () => {
    // Belt and braces on the contract the job detail screen depends on.
    spyOnRpc().mockImplementation(() => { throw new Error('synchronous boom'); });
    await expect(fetchClientPhone(jobId())).resolves.toBeNull();
  });
});
