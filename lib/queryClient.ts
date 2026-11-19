import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { errorKind } from './errorWords';

/**
 * End the session on this phone when a request failed because the server
 * rejected it and will not renew it. Supabase only fires SIGNED_OUT when it
 * ends the session itself, so without this the driver would read "You've been
 * signed out" and stay stuck on Retry. Signing out locally fires SIGNED_OUT, and the
 * root layout's hook (lib/useReturnToSignInOnSignOut.ts) opens Sign in.
 *
 * It tries one renewal first. Just after the phone wakes, a request can fail as
 * expired while the renewal is still on its way; that session must survive, so
 * only a renewal the server refuses ends it. A renewal that fails for lack of
 * signal, or because the login server is briefly down (supabase-js marks both
 * retryable and keeps the session on purpose), keeps the session too.
 *
 * Failures that arrive together (a screen loading several things at once)
 * share one renewal instead of each asking the login server. When the renewal
 * works, screens on show that failed as signed out reload by themselves, so
 * the driver does not stay on "You've been signed out" until Retry.
 */
export function endSessionIfSignedOut(e: unknown): Promise<void> {
  if (errorKind(e) !== 'signedOut') return Promise.resolve();
  renewal ??= renewOrEnd().finally(() => { renewal = null; });
  return renewal;
}

let renewal: Promise<void> | null = null;

async function renewOrEnd(): Promise<void> {
  try {
    // Lazy require: lib/supabase.ts builds a live client at import time, and
    // tests that import this client for other reasons must not need its mock.
    const { supabase } = require('./supabase');
    const { error } = await supabase.auth.refreshSession();
    if (!error) return reloadSignedOutScreens();
    if (error.name === 'AuthRetryableFetchError' || errorKind(error) === 'offline') return;
    await supabase.auth.signOut({ scope: 'local' });
  } catch {}
}

// A screen is reloaded by itself at most once a minute. If it fails as signed
// out again straight after a working renewal, something else is wrong, and
// reloading again would only loop; the driver still has Retry.
const RELOAD_GAP_MS = 60_000;
const lastReload = new WeakMap<object, number>();

function reloadSignedOutScreens(): void {
  const now = Date.now();
  const failed = queryClient.getQueryCache().findAll({
    type: 'active',
    predicate: (q) =>
      q.state.status === 'error' &&
      errorKind(q.state.error) === 'signedOut' &&
      now - (lastReload.get(q) ?? -Infinity) >= RELOAD_GAP_MS,
  });
  failed.forEach((q) => lastReload.set(q, now));
  if (failed.length) void queryClient.refetchQueries({ predicate: (q) => failed.includes(q) });
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
