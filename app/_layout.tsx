import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTokens, useThemeControls } from '../theme/ThemeProvider';
import { queryClient } from '../lib/queryClient';
import { ensureDevSession, DevSessionResult } from '../lib/devSession';

export default function RootLayout() {
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

function ThemedShell({ session }: { session: DevSessionResult | null }) {
  const T = useTokens();
  const { resolvedTheme } = useThemeControls();
  // Expose session status on a global for screens that want to nudge the user.
  // Not a state container — just a one-shot diagnostic.
  (globalThis as any).__FLEETMS_DEV_SESSION__ = session;

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
        <Stack.Screen name="sign-in"/>
        <Stack.Screen name="(tabs)"/>
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
      </Stack>
    </>
  );
}
