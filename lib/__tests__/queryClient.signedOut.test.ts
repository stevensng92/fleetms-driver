// A server that rejects the driver's session while the phone still holds one
// (a wrong phone clock, or a renewal still pending after the phone wakes) never
// fires Supabase's SIGNED_OUT on its own. The driver would read "You've been
// signed out" and stay stuck on Retry. So any download or button press that
// fails as signed out ends the session on this phone, which fires SIGNED_OUT
// and lets the sign-out hook open Sign in.
// Before signing out it tries one renewal: a request just after the phone wakes
// can fail as expired while the renewal is still on its way, and that session
// must survive. Only a renewal the server refuses ends the session.
const mockSignOut = jest.fn().mockResolvedValue({ error: null });
const mockRefresh = jest.fn();
jest.mock('../supabase', () => ({ supabase: { auth: { signOut: mockSignOut, refreshSession: mockRefresh } } }));

import { endSessionIfSignedOut, queryClient } from '../queryClient';

const pg = (message: string, code: string) => ({ message, code, details: null, hint: null });

const refused = { data: { session: null }, error: { name: 'AuthApiError', message: 'Invalid Refresh Token: Refresh Token Not Found', status: 400 } };

beforeEach(() => {
  mockSignOut.mockClear();
  mockRefresh.mockReset().mockResolvedValue(refused);
});

describe('endSessionIfSignedOut', () => {
  it('ends the session on this phone when the server says it expired and refuses to renew it', async () => {
    await endSessionIfSignedOut(pg('JWT expired', 'PGRST301'));
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps the session when the renewal works (the phone just woke up)', async () => {
    mockRefresh.mockResolvedValue({ data: { session: { access_token: 'fresh' } }, error: null });
    await endSessionIfSignedOut(pg('JWT expired', 'PGRST301'));
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('keeps the session when the renewal fails only for lack of signal', async () => {
    mockRefresh.mockResolvedValue({ data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 } });
    await endSessionIfSignedOut(pg('JWT expired', 'PGRST301'));
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  // A bare 401 counts as signed out too, by the same renewal check.
  it('treats a bare 401 the same way', async () => {
    await endSessionIfSignedOut({ status: 401, message: 'Unauthorized' });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it.each([
    ['no signal', new TypeError('Network request failed')],
    ['not allowed', pg('permission denied for table jobs', '42501')],
    ['dispatch changed the job', new Error('Cannot start a pending job (must be confirmed)')],
    ['anything else', new Error('boom')],
  ])('leaves the session alone for %s', async (_n, e) => {
    await endSessionIfSignedOut(e);
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('never throws when signing out fails', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('storage gone'));
    await expect(endSessionIfSignedOut(pg('JWT expired', 'PGRST301'))).resolves.toBeUndefined();
  });
});

// The cache calls the check without waiting for it; let its promise settle.
async function waitForSignOut() {
  for (let i = 0; i < 10 && !mockSignOut.mock.calls.length; i++) await Promise.resolve();
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
}

describe('the shared query client', () => {
  it('ends the session when a download fails as signed out', async () => {
    await expect(queryClient.fetchQuery({
      queryKey: ['signed-out-probe'],
      queryFn: () => Promise.reject(pg('JWT expired', 'PGRST301')),
      retry: false,
    })).rejects.toBeTruthy();
    await waitForSignOut();
  });

  it('ends the session when a button press fails as signed out', async () => {
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(pg('JWT expired', 'PGRST301')),
      retry: false,
    });
    await expect(mutation.execute(undefined)).rejects.toBeTruthy();
    await waitForSignOut();
  });
});
