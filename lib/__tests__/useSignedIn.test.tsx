// Push setup runs whenever a driver is signed in, not only at app start, so
// signing out and back in (or a phone's first sign-in) saves the push address
// again without a restart. This hook is what tells the root layout.
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

import { useSignedIn } from '../useSignedIn';

const session = { access_token: 'synthetic' };

beforeEach(() => { mockListener = null; mockUnsubscribe.mockClear(); });

describe('useSignedIn', () => {
  it('is false until the first auth event says otherwise', async () => {
    const { result } = await renderHook(() => useSignedIn());
    expect(result.current).toBe(false);
    await act(async () => { mockListener!('INITIAL_SESSION', session); });
    expect(result.current).toBe(true);
  });

  it('turns false on sign-out and true again on the next sign-in', async () => {
    const { result } = await renderHook(() => useSignedIn());
    await act(async () => { mockListener!('INITIAL_SESSION', session); });
    await act(async () => { mockListener!('SIGNED_OUT', null); });
    expect(result.current).toBe(false);
    await act(async () => { mockListener!('SIGNED_IN', session); });
    expect(result.current).toBe(true);
  });

  it('stops listening when the layout goes away', async () => {
    const { unmount } = await renderHook(() => useSignedIn());
    await act(async () => { unmount(); });
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
