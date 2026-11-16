// Signing out takes the phone's push address off the driver first, so a
// signed-out phone stops getting that driver's job alerts. The server only
// knows whose address to clear while the driver is still signed in, so the
// clear must run before the session ends, and it must never block sign-out.

const mockCalls: string[] = [];
let mockClearImpl: () => Promise<void> = async () => { mockCalls.push('clear'); };
const mockAuthSignOut = jest.fn(async () => { mockCalls.push('signOut'); return { error: null }; });

jest.mock('../supabase', () => ({
  supabase: { auth: { signOut: (...a: unknown[]) => mockAuthSignOut(...(a as [])) } },
}));
jest.mock('../push', () => ({
  clearPushNotifications: () => mockClearImpl(),
}));

import { signOut } from '../auth';

beforeEach(() => {
  mockCalls.length = 0;
  mockAuthSignOut.mockClear();
  mockClearImpl = async () => { mockCalls.push('clear'); };
});

describe('signOut', () => {
  it('clears the push address before ending the session', async () => {
    await signOut();
    expect(mockCalls).toEqual(['clear', 'signOut']);
  });

  it('still signs out when clearing fails', async () => {
    mockClearImpl = async () => { mockCalls.push('clear'); throw new Error('offline'); };
    await signOut();
    expect(mockCalls).toEqual(['clear', 'signOut']);
  });

  it('stops waiting for a hung clear after 2 seconds and signs out', async () => {
    jest.useFakeTimers();
    try {
      mockClearImpl = () => { mockCalls.push('clear'); return new Promise<void>(() => {}); };
      const done = signOut();
      await jest.advanceTimersByTimeAsync(1999);
      expect(mockAuthSignOut).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await done;
      expect(mockCalls).toEqual(['clear', 'signOut']);
    } finally {
      jest.useRealTimers();
    }
  });
});
