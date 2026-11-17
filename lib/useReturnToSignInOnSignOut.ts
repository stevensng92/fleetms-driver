import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

/**
 * Take the driver back to the sign-in screen whenever their session ends: the
 * Sign out button, or an expired session the app could not renew (Supabase
 * fires SIGNED_OUT for both). Not on INITIAL_SESSION with no session: that is
 * a first launch, and the start-up gate (app/index.tsx) already routes it.
 *
 * `ready` is the root navigator's readiness, kept in a ref so the listener
 * subscribes once and never navigates before the navigator can handle it.
 */
export function useReturnToSignInOnSignOut(router: { replace: (href: '/sign-in') => void }, ready: boolean) {
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const routerRef = useRef(router);
  routerRef.current = router;
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && readyRef.current) routerRef.current.replace('/sign-in');
    });
    return () => data.subscription.unsubscribe();
  }, []);
}
