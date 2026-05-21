import React from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { Redirect } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../lib/supabase';
import { fetchDriverProfile } from '../lib/auth';
import { useTokens } from '../theme/ThemeProvider';
import { AppFrame } from '../components/AppFrame';

// Session gate. Three terminal states:
//   - no session             → /sign-in
//   - session, pin not set   → /set-pin
//   - session, pin set       → /(tabs)
//
// The gate runs once per cold start; subsequent routing happens inside the
// sign-in / set-pin screens themselves on submit.
type Destination = '/sign-in' | '/set-pin' | '/(tabs)';

export default function Entry() {
  const T = useTokens();
  const [destination, setDestination] = React.useState<Destination | null>(null);
  const [transientError, setTransientError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!alive) return;
      if (!session) { setDestination('/sign-in'); return; }
      const result = await fetchDriverProfile();
      if (!alive) return;

      if (result.kind === 'error') {
        // Transient: network/Supabase blip. Keep the session, show a retry UI.
        // Booting out on every blip is a paper cut — re-auth via PIN every time.
        setTransientError(result.message);
        return;
      }

      if (result.kind === 'no-row') {
        // Session is valid but no driver row visible. Either the dispatcher
        // deleted the row OR RLS regressed. Surface both via Sentry so an
        // RLS policy regression doesn't silently log everyone out at once.
        Sentry.captureMessage('Session present but no driver row visible', {
          level: 'warning',
          tags: { component: 'session-gate' },
        });
        await supabase.auth.signOut();
        setDestination('/sign-in');
        return;
      }

      setDestination(result.profile.pinSet ? '/(tabs)' : '/set-pin');
    })();
    return () => { alive = false; };
  }, [attempt]);

  if (transientError) {
    return (
      <AppFrame bg={T.surface}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: T.text, marginBottom: 8 }}>
            Couldn&apos;t reach the server
          </Text>
          <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center', marginBottom: 18 }}>
            Check your connection and try again. You&apos;re still signed in.
          </Text>
          <Pressable
            onPress={() => { setTransientError(null); setAttempt(a => a + 1); }}
            style={({ pressed }) => ({
              paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8,
              backgroundColor: T.primary, opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: T.primaryFg, fontSize: 14, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      </AppFrame>
    );
  }

  if (!destination) {
    return (
      <AppFrame bg={T.surface}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={T.muted}/>
        </View>
      </AppFrame>
    );
  }

  // Cast: '/set-pin' isn't in the generated router types until expo regenerates.
  return <Redirect href={destination as '/sign-in'}/>;
}
