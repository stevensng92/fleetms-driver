import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Whether a driver is signed in right now, following every sign-in and
 * sign-out (Supabase fires INITIAL_SESSION on subscribe, then SIGNED_IN /
 * SIGNED_OUT / TOKEN_REFRESHED). The root layout keys push setup off this, so
 * a sign-in saves the push address again without an app restart: sign-out
 * clears it on the server.
 */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn;
}
