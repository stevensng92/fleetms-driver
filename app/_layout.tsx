import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { ThemeProvider, useTokens, useThemeControls } from '../theme/ThemeProvider';
import { queryClient } from '../lib/queryClient';
import { ensureDevSession, DevSessionResult } from '../lib/devSession';
import { ensurePushNotifications } from '../lib/push';

// Crash + JS-error reporting. Captures Fabric "child already has parent" and
// other native crashes with native stack traces, plus any unhandled JS errors.
// Free tier is plenty for our scale; toggle off by removing EXPO_PUBLIC_SENTRY_DSN.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Send a sample of normal traffic so we can see what was happening before
    // a crash (e.g. last screen visited). 0.0 = errors-only.
    tracesSampleRate: 0.1,
    // We don't ship dev builds; keep it on in __DEV__ too so we catch issues
    // when iterating locally.
    enabled: true,
  });
}

function RootLayoutImpl() {
  const [session, setSession] = useState<DevSessionResult | null>(null);

  useEffect(() => {
    let alive = true;
    ensureDevSession().then(r => { if (alive) setSession(r); });
    return () => { alive = false; };
  }, []);

  // Render the shell even before the dev-session resolves — screens will
  // show their own loading state via TanStack Query.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ThemedShell session={session}/>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Wrap the root so Sentry can hook into React's error boundary + ErrorUtils.
export default SENTRY_DSN ? Sentry.wrap(RootLayoutImpl) : RootLayoutImpl;

function ThemedShell({ session }: { session: DevSessionResult | null }) {
  const T = useTokens();
  const { resolvedTheme } = useThemeControls();
  const router = useRouter();
  // Expose session status on a global for screens that want to nudge the user.
  // Not a state container — just a one-shot diagnostic.
  (globalThis as any).__FLEETMS_DEV_SESSION__ = session;

  // Register push notifications once the session is up. Idempotent — the
  // helper short-circuits if the token hasn't changed across cold starts.
  useEffect(() => {
    if (session?.kind !== 'ok') return;
    let alive = true;
    ensurePushNotifications(router).then(r => {
      if (!alive) return;
      (globalThis as any).__FLEETMS_PUSH__ = r;
    });
    return () => { alive = false; };
  }, [session?.kind, router]);

  return (
    <>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'}/>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: T.page },
          animation: 'slide_from_right',
        }}
      >
        {/* Auth screens use animation: 'none' to dodge a RN Fabric race where
            the heavy next-screen layout mounts while the auth screen is still
            sliding out, crashing with "child already has parent" (issue first
            captured in Sentry on 2026-05-20). */}
        <Stack.Screen name="sign-in" options={{ animation: 'none' }}/>
        <Stack.Screen name="set-pin" options={{ animation: 'none' }}/>
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }}/>
        <Stack.Screen name="jobs/[id]"/>
        <Stack.Screen name="jobs/active"/>
        <Stack.Screen
          name="expenses/log"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="expenses/[id]"/>
        <Stack.Screen
          name="profile/time-off"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="notifications"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </>
  );
}
