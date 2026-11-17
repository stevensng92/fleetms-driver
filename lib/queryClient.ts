import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { errorKind } from './errorWords';

/**
 * End the session on this phone when a request failed because the server
 * rejected it (expired, or a wrong phone clock, or a renewal still pending
 * after the phone woke). Supabase only fires SIGNED_OUT when it ends the
 * session itself, so without this the driver would read "You've been signed
 * out" and stay stuck on Retry. Signing out locally fires SIGNED_OUT, and the
 * root layout's hook (lib/useReturnToSignInOnSignOut.ts) opens Sign in.
 *
 * It tries one renewal first. Just after the phone wakes, a request can fail as
 * expired while the renewal is still on its way; that session must survive, so
 * only a renewal the server refuses ends it. A renewal that fails for lack of
 * signal keeps the session too: the driver gets "No signal" next time instead.
 */
export async function endSessionIfSignedOut(e: unknown): Promise<void> {
  if (errorKind(e) !== 'signedOut') return;
  try {
    // Lazy require: lib/supabase.ts builds a live client at import time, and
    // tests that import this client for other reasons must not need its mock.
    const { supabase } = require('./supabase');
    const { error } = await supabase.auth.refreshSession();
    if (!error || errorKind(error) === 'offline') return;
    await supabase.auth.signOut({ scope: 'local' });
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
