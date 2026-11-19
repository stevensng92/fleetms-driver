// Two follow-ups to the renewal in endSessionIfSignedOut (PR #36 review):
// 1. Screens that failed as signed out reload by themselves once a renewal
//    works. Without this the driver kept reading "You've been signed out"
//    until they tapped Retry, though the session was fine again.
// 2. Failures that arrive together share one renewal, instead of each asking
//    the login server for a new session at the same moment.
import { QueryObserver } from '@tanstack/react-query';

const mockSignOut = jest.fn().mockResolvedValue({ error: null });
const mockRefresh = jest.fn();
jest.mock('../supabase', () => ({ supabase: { auth: { signOut: mockSignOut, refreshSession: mockRefresh } } }));

import { endSessionIfSignedOut, queryClient } from '../queryClient';

const expired = () => ({ message: 'JWT expired', code: 'PGRST301', details: null, hint: null });
const renewed = { data: { session: { access_token: 'fresh' } }, error: null };
const refused = { data: { session: null }, error: { name: 'AuthApiError', message: 'Invalid Refresh Token: Refresh Token Not Found', status: 400 } };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

// A screen on show: an observer keeps the query active, as a mounted hook does.
function showScreen(key: string, queryFn: () => Promise<unknown>) {
  const observer = new QueryObserver(queryClient, { queryKey: [key], queryFn, retry: false });
  const unsubscribe = observer.subscribe(() => {});
  return { observer, unsubscribe };
}

let screens: Array<() => void> = [];

beforeEach(() => {
  mockSignOut.mockClear();
  mockRefresh.mockReset().mockResolvedValue(renewed);
});

afterEach(() => {
  screens.forEach((u) => u());
  screens = [];
  queryClient.clear();
});

describe('failures that arrive together', () => {
  it('share one renewal', async () => {
    const pending = deferred<typeof renewed>();
    mockRefresh.mockReturnValue(pending.promise);
    const all = Promise.all([endSessionIfSignedOut(expired()), endSessionIfSignedOut(expired()), endSessionIfSignedOut(expired())]);
    pending.resolve(renewed);
    await all;
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('sign out once when the shared renewal is refused', async () => {
    mockRefresh.mockResolvedValue(refused);
    await Promise.all([endSessionIfSignedOut(expired()), endSessionIfSignedOut(expired())]);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('a failure after the renewal finished starts a new one', async () => {
    await endSessionIfSignedOut(expired());
    await endSessionIfSignedOut(expired());
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });
});

describe('screens that failed as signed out', () => {
  it('reload by themselves once the renewal works', async () => {
    let calls = 0;
    const { observer, unsubscribe } = showScreen('jobs', () => (++calls === 1 ? Promise.reject(expired()) : Promise.resolve(['job'])));
    screens.push(unsubscribe);
    await settle();
    expect(calls).toBe(2);
    expect(observer.getCurrentResult().data).toEqual(['job']);
  });

  it('stay put when the renewal is refused (the driver is sent to Sign in instead)', async () => {
    mockRefresh.mockResolvedValue(refused);
    let calls = 0;
    const { unsubscribe } = showScreen('jobs', () => { calls++; return Promise.reject(expired()); });
    screens.push(unsubscribe);
    await settle();
    expect(calls).toBe(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('reload only once if they fail as signed out again, so it never loops', async () => {
    let calls = 0;
    const { observer, unsubscribe } = showScreen('jobs', () => { calls++; return Promise.reject(expired()); });
    screens.push(unsubscribe);
    await settle();
    await settle();
    expect(calls).toBe(2);
    expect(observer.getCurrentResult().status).toBe('error');
  });

  it('leave screens that failed for another reason alone', async () => {
    let otherCalls = 0;
    const other = showScreen('earnings', () => { otherCalls++; return Promise.reject(new Error('boom')); });
    screens.push(other.unsubscribe);
    await settle();
    let calls = 0;
    const jobs = showScreen('jobs', () => (++calls === 1 ? Promise.reject(expired()) : Promise.resolve([])));
    screens.push(jobs.unsubscribe);
    await settle();
    expect(calls).toBe(2);
    expect(otherCalls).toBe(1);
  });
});
