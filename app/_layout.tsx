import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { ThemeProvider, useTokens, useThemeControls } from '../theme/ThemeProvider';
import { queryClient } from '../lib/queryClient';
import { ensureDevSession, DevSessionResult } from '../lib/devSession';
import { ensurePushNotifications } from '../lib/push';
import { reportAppVersion } from '../lib/version';
import { useAppVersionGate } from '../lib/queries/appVersionConfig';
import { UpdateRequiredScreen } from '../components/UpdateRequiredScreen';

// Crash + JS-error reporting. Captures Fabric "child already has parent" and
// other native crashes with native stack traces, plus any unhandled JS errors.
// Free tier is plenty for our scale; toggle off by removing EXPO_PUBLIC_SENTRY_DSN.
//
// Release + dist are set explicitly here rather than relying on the
// @sentry/react-native/expo plugin's native-side injection. Observed in
// production v0.1.0+1 and v0.3.x: events arrived with release=NONE despite
// the plugin running at build time, so sessions silently dropped (Sentry
// aggregates sessions by release; no release = no session bucket). Setting
// them explicitly here is belt-and-suspenders and keeps the source-map
// upload path working — the plugin still runs at build time, this just
// ensures the runtime SDK tags events even if the native injection fails.
//
// Build number is hardcoded because expo-application isn't installed and
// Constants doesn't expose nativeBuildVersion. eas.json's preview profile
// now has autoIncrement: true (remote versionCode source), so EVERY release
// build bumps the remote versionCode by 1 — bump APP_BUILD in the same
// commit as the release cut, or pull expo-application in to read it
// dynamically. v0.4.0 shipped as versionCode 2; v0.5.0 is the next release
// build, so versionCode 3.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const APP_BUILD = '3';
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    release: `my.fleetms.driver@${APP_VERSION}+${APP_BUILD}`,
    dist: APP_BUILD,
    environment: __DEV__ ? 'development' : 'production',
    enableAutoSessionTracking: true,
    // Send a sample of normal traffic so we can see what was happening before
    // a crash (e.g. last screen visited). 0.0 = errors-only.
    tracesSampleRate: 0.1,
    // We don't ship dev builds; keep it on in __DEV__ too so we catch issues
    // when iterating locally.
    enabled: true,
  });

  // Cold-start heartbeat. Observed in v0.3.2+1: SDK initialised cleanly
  // (RNSentry: "Starting with DSN ..." in logcat, all native integrations
  // registered) but zero sessions and zero events made it to the cloud
  // even after backgrounding the app and a known JS error reaching the
  // error boundary. This one-shot message guarantees AT LEAST one event
  // per cold start, which gives us:
  //   - a definitive "SDK → cloud is reachable" smoke test per release
  //   - a session-anchor row so AppLifecycleIntegration can hang the
  //     session on something (without an in-flight event, some Sentry
  //     SDK builds drop the empty session entirely)
  // One event per cold start is negligible quota-wise (~< 1k/month even
  // at full driver rollout). Drop or rate-limit later if it ever becomes
  // noisy.
  Sentry.captureMessage(`app_started v${APP_VERSION}+${APP_BUILD}`, 'info');
}

function RootLayoutImpl() {
  const [session, setSession] = useState<DevSessionResult | null>(null);

  // Belt-and-suspenders Sentry flush on app background. The native
  // AppLifecycleIntegration is supposed to do this automatically but we
  // observed it isn't firing reliably on v0.3.2+1 (Sentry SDK 7.2 + Expo
  // SDK 54 + RN New Architecture + React Compiler — at least one of those
  // breaks the path). flush() returns once queued events drain or fail;
  // cheap to call, no-op when the queue is already empty.
  //
  // The @sentry/react-native v7.2 re-export of flush() takes zero args
  // (the timeout overload from @sentry/core doesn't make it through).
  useEffect(() => {
    if (!process.env.EXPO_PUBLIC_SENTRY_DSN) return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        Sentry.flush().catch(() => {
          // Network down, Sentry endpoint down — nothing to do, dropping
          // the queued envelopes is the failure mode either way.
        });
      }
    });
    return () => sub.remove();
  }, []);

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
  const versionGate = useAppVersionGate();
  // Expose session status on a global for screens that want to nudge the user.
  // Not a state container — just a one-shot diagnostic.
  (globalThis as any).__FLEETMS_DEV_SESSION__ = session;

  // Root navigator readiness. When the app is cold-started by tapping a push
  // notification, expo-notifications replays that tap's response the instant
  // ensurePushNotifications() subscribes its listener — which can race ahead
  // of the Stack below actually mounting on a slower device, so the
  // listener's router.push(deeplink) throws "Attempted to navigate before
  // mounting the Root Layout component" (captured in Sentry, FLEETMS-DRIVER-4,
  // 2026-07-09) and the deep link is silently lost. Gating push setup on
  // rootNavigationState.key means the listener only ever subscribes once the
  // navigator can actually handle a push, so the replayed tap can't outrun it.
  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = !!rootNavigationState?.key;

  // Register push notifications once the session is up AND the navigator is
  // ready. Idempotent — the helper short-circuits if the token hasn't
  // changed across cold starts.
  useEffect(() => {
    if (session?.kind !== 'ok') return;
    if (!isNavigationReady) return;
    let alive = true;
    ensurePushNotifications(router).then(r => {
      if (!alive) return;
      (globalThis as any).__FLEETMS_PUSH__ = r;
    });
    return () => { alive = false; };
  }, [session?.kind, isNavigationReady, router]);

  // Report the installed build's version — separate from push registration
  // above, and gated ONLY on the session (not push permission or navigator
  // readiness) so a driver with notifications off still shows up in the
  // dispatcher's Drivers panel as running this build, not "Not reported".
  useEffect(() => {
    if (session?.kind !== 'ok') return;
    reportAppVersion();
  }, [session?.kind]);

  // Separate from the Sentry-flush listener above — this one re-checks the
  // force-update config whenever the app comes back to the foreground, so a
  // driver who backgrounds and resumes gets a fresh answer without needing a
  // full cold start.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        queryClient.invalidateQueries({ queryKey: ['app-version-config'] });
      }
    });
    return () => sub.remove();
  }, []);

  // Hard block takes over the ENTIRE app — including the sign-in screen —
  // before any auth/routing decision is made. Still rendered inside the
  // GestureHandlerRootView/SafeAreaProvider/QueryClientProvider/ThemeProvider
  // wrappers (this function runs inside all of them) so theming still works.
  if (versionGate.status === 'required') {
    return (
      <>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'}/>
        <UpdateRequiredScreen
          currentVersion={versionGate.currentVersion}
          minimumVersion={versionGate.minimumVersion}
        />
      </>
    );
  }

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
