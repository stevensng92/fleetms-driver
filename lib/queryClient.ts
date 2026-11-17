import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { errorKind } from './errorWords';

/**
 * End the session on this phone when a request failed because the server
 * rejected it (expired, or a wrong phone clock, or a renewal still pending
 * after the phone woke). Supabase only fires SIGNED_OUT when it ends the
 * session itself, so without this the driver would read "You've been signed
 * out" and stay stuck on Retry. Signing out locally fires SIGNED_OUT, and the
 * root layout's hook (lib/useReturnToSignInOnSignOut.ts) opens Sign in.
 */
export function endSessionIfSignedOut(e: unknown): void {
  if (errorKind(e) !== 'signedOut') return;
  // Lazy require: lib/supabase.ts builds a live client at import time, and
  // tests that import this client for other reasons must not need its mock.
  try {
    const p = require('./supabase').supabase.auth.signOut({ scope: 'local' });
    p?.catch?.(() => {});
  } catch {}
}

// Conservative defaults tuned for a phone on flaky LTE.
//   - staleTime 30s: prevents thrash on rapid screen revisits.
//   - retry 2: typical mobile dropouts recover within a couple of tries.
//   - refetchOnReconnect: when LTE comes back, refresh the jobs list.
// Every failed download and button press goes through endSessionIfSignedOut.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: endSessionIfSignedOut }),
  mutationCache: new MutationCache({ onError: endSessionIfSignedOut }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
