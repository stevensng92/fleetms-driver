// When the driver's session ends (the Sign out button, or an expired session the
// app could not renew) the app must go back to the sign-in screen, or the driver
// is stuck on a screen that can no longer load. First launch with no session is
// NOT a sign-out: the start-up gate (app/index.tsx) already handles that.
import { act, renderHook } from '@testing-library/react-native';

type Listener = (event: string, session: object | null) => void;
let mockListener: Listener | null = null;
const mockUnsubscribe = jest.fn();
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: Listener) => {
        mockListener = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
  },
}));

import { useReturnToSignInOnSignOut } from '../useReturnToSignInOnSignOut';

const session = { access_token: 'synthetic' };
const router = { replace: jest.fn() };

beforeEach(() => { mockListener = null; mockUnsubscribe.mockClear(); router.replace.mockClear(); });

describe('useReturnToSignInOnSignOut', () => {
  it('sends the driver to sign-in when the session ends', async () => {
    await renderHook(() => useReturnToSignInOnSignOut(router, true));
    await act(async () => { mockListener!('SIGNED_OUT', null); });
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('does nothing on first launch with no session (the start-up gate handles it)', async () => {
    await renderHook(() => useReturnToSignInOnSignOut(router, true));
    await act(async () => { mockListener!('INITIAL_SESSION', null); });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does nothing on sign-in or a token refresh', async () => {
    await renderHook(() => useReturnToSignInOnSignOut(router, true));
    await act(async () => { mockListener!('SIGNED_IN', session); });
    await act(async () => { mockListener!('TOKEN_REFRESHED', session); });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not navigate before the navigator is ready', async () => {
    await renderHook(() => useReturnToSignInOnSignOut(router, false));
    await act(async () => { mockListener!('SIGNED_OUT', null); });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('follows the navigator becoming ready without listening again', async () => {
    const { rerender } = await renderHook(
      ({ ready }: { ready: boolean }) => useReturnToSignInOnSignOut(router, ready),
      { initialProps: { ready: false } },
    );
    await rerender({ ready: true });
    await act(async () => { mockListener!('SIGNED_OUT', null); });
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('stops listening when the layout goes away', async () => {
    const { unmount } = await renderHook(() => useReturnToSignInOnSignOut(router, true));
    await act(async () => { unmount(); });
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
