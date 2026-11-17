// A server that rejects the driver's session while the phone still holds one
// (a wrong phone clock, or a renewal still pending after the phone wakes) never
// fires Supabase's SIGNED_OUT on its own. The driver would read "You've been
// signed out" and stay stuck on Retry. So any download or button press that
// fails as signed out ends the session on this phone, which fires SIGNED_OUT
// and lets the sign-out hook open Sign in.
const mockSignOut = jest.fn().mockResolvedValue({ error: null });
jest.mock('../supabase', () => ({ supabase: { auth: { signOut: mockSignOut } } }));

import { endSessionIfSignedOut, queryClient } from '../queryClient';

const pg = (message: string, code: string) => ({ message, code, details: null, hint: null });

beforeEach(() => mockSignOut.mockClear());

describe('endSessionIfSignedOut', () => {
  it('ends the session on this phone when the server says the session expired', () => {
    endSessionIfSignedOut(pg('JWT expired', 'PGRST301'));
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it.each([
    ['no signal', new TypeError('Network request failed')],
    ['not allowed', pg('permission denied for table jobs', '42501')],
    ['dispatch changed the job', new Error('Cannot start a pending job (must be confirmed)')],
    ['anything else', new Error('boom')],
  ])('leaves the session alone for %s', (_n, e) => {
    endSessionIfSignedOut(e);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('never throws when signing out fails', () => {
    mockSignOut.mockImplementationOnce(() => { throw new Error('storage gone'); });
    expect(() => endSessionIfSignedOut(pg('JWT expired', 'PGRST301'))).not.toThrow();
  });
});

describe('the shared query client', () => {
  it('ends the session when a download fails as signed out', async () => {
    await expect(queryClient.fetchQuery({
      queryKey: ['signed-out-probe'],
      queryFn: () => Promise.reject(pg('JWT expired', 'PGRST301')),
      retry: false,
    })).rejects.toBeTruthy();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('ends the session when a button press fails as signed out', async () => {
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(pg('JWT expired', 'PGRST301')),
      retry: false,
    });
    await expect(mutation.execute(undefined)).rejects.toBeTruthy();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
