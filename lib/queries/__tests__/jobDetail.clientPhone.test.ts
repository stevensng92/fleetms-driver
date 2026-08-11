// First Supabase-mocked test in this repo. AGENTS.md notes that the query
// modules are uncovered because "anything importing lib/supabase.ts builds a
// live client at import time" — which is true, and this is the way around it:
// mock the module, so importing the query never constructs a client at all.
//
// Worth having despite being three lines of function: fetchClientPhone's whole
// job is to FAIL QUIETLY. If it ever starts throwing, the job detail screen
// dies on jobs that have no client phone, which is most of them. That is the
// exact failure a passing type-check cannot see.

const mockRpc = jest.fn();

jest.mock('../../supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import { fetchClientPhone } from '../jobDetail';
import { captureException } from '@sentry/react-native';

// Synthetic. It is only an opaque argument to a mocked RPC, and this repo is
// public — no reason to carry a real job id into it.
const JOB = '00000000-0000-4000-8000-000000000001';

describe('fetchClientPhone', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    (captureException as jest.Mock).mockClear();
  });

  it('passes the job id under the parameter name the RPC declares', async () => {
    // The SQL signature is driver_job_client_phone(target_job_id uuid). A
    // renamed key here fails at runtime with a PostgREST 404 that looks like
    // "function does not exist" — nothing type-checks this boundary.
    mockRpc.mockResolvedValue({ data: '+60111111111', error: null });
    await fetchClientPhone(JOB);
    expect(mockRpc).toHaveBeenCalledWith('driver_job_client_phone', { target_job_id: JOB });
  });

  it('returns the number the RPC resolved', async () => {
    mockRpc.mockResolvedValue({ data: '+60111111111', error: null });
    await expect(fetchClientPhone(JOB)).resolves.toBe('+60111111111');
  });

  it('returns null when the caller is not entitled to a number', async () => {
    // The RPC answers NULL rather than raising for every denial: not assigned,
    // deactivated driver, wrong org, no client on the job.
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(fetchClientPhone(JOB)).resolves.toBeNull();
  });

  it('degrades to null and reports when the RPC returns an error', async () => {
    // The shape that matters: dispatcher-side migration not applied yet, so
    // the function does not exist. The screen must still render with the
    // passenger number alone.
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
    await expect(fetchClientPhone(JOB)).resolves.toBeNull();
    expect(captureException).toHaveBeenCalled();
  });

  it('degrades to null when the call rejects outright', async () => {
    // Offline, or the fetch itself throws before PostgREST answers.
    mockRpc.mockRejectedValue(new Error('Network request failed'));
    await expect(fetchClientPhone(JOB)).resolves.toBeNull();
    expect(captureException).toHaveBeenCalled();
  });

  it('never throws, whatever the client does', async () => {
    // Belt and braces on the contract the job detail screen depends on.
    mockRpc.mockImplementation(() => { throw new Error('synchronous boom'); });
    await expect(fetchClientPhone(JOB)).resolves.toBeNull();
  });
});
