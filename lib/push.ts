// FleetMS Driver — push notification setup.
//
// Single entry-point: `ensurePushNotifications(router)`.
//
//   1. Asks for permission (idempotent — system remembers the answer)
//   2. Fetches the Expo push token
//   3. Calls register_driver_push_token(token) RPC on Supabase
//   4. Wires a foreground listener (badge updates while app is open)
//   5. Wires a tap-response listener (deep-link routing)
//
// Call it from the root layout after the dev-session resolves, so we don't
// register a token for an unauthenticated session. Safe to call multiple
// times; cleans up the previous listeners on each call.

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { Router } from 'expo-router';
import { supabase } from './supabase';

// Foreground notification UX: show banner + play sound. Quieter alternatives
// were considered; drivers expect to be interrupted by job assignments even
// when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

let responseSub: Notifications.Subscription | null = null;
let registeredToken: string | null = null;

export type PushSetupResult =
  | { kind: 'ok'; token: string }
  | { kind: 'denied' }
  | { kind: 'not-physical-device' }
  | { kind: 'no-project-id' }
  | { kind: 'error'; message: string };

export async function ensurePushNotifications(router: Router): Promise<PushSetupResult> {
  if (!Device.isDevice) {
    // Push tokens are only issued on real hardware (Expo Go on a simulator
    // returns nothing). Don't ask for permission, don't register.
    return { kind: 'not-physical-device' };
  }

  // Android requires a notification channel to be declared up front to be
  // able to set sound + importance per channel.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync('high-priority', {
      name: 'High priority',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') {
    return { kind: 'denied' };
  }

  // Need an EAS project id to mint a push token for production builds. In
  // Expo Go on dev, this works via Expo's hosted service. SDK 54 reads from
  // app.json -> extra.eas.projectId or expo-config.
  const projectId =
    (Constants.expoConfig as any)?.extra?.eas?.projectId ??
    (Constants.easConfig as any)?.projectId ??
    undefined;

  let tokenResult;
  try {
    tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
  } catch (e: any) {
    return { kind: 'error', message: e?.message ?? String(e) };
  }
  const token = tokenResult.data;

  // Skip the RPC if token is unchanged from last register (cheap dedup).
  // registeredToken resets to null on every cold start, so the version below
  // is re-reported on each launch — that's how a driver's row picks up the
  // new build after they update.
  if (token && token !== registeredToken) {
    // Piggyback the app's semver so ops can see which build each driver runs.
    // expo-application isn't installed; expoConfig.version is the semver from
    // app.json baked in at build time, which is all we need here.
    const appVersion = Constants.expoConfig?.version ?? null;
    const { error } = await supabase.rpc('register_driver_push_token', {
      p_token: token,
      p_app_version: appVersion,
    });
    if (error) {
      return { kind: 'error', message: error.message };
    }
    registeredToken = token;
  }

  // Tap-response listener. Wire once per ensurePushNotifications() call.
  if (responseSub) {
    responseSub.remove();
    responseSub = null;
  }
  responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data: any = response.notification.request.content.data ?? {};
    const deeplink: string | undefined = data.deeplink;
    if (deeplink) {
      router.push(deeplink as any);
    }
  });

  return { kind: 'ok', token };
}

// Call on sign-out to drop the token server-side so the driver stops
// receiving alerts on this device.
export async function clearPushNotifications() {
  registeredToken = null;
  if (responseSub) { responseSub.remove(); responseSub = null; }
  try { await supabase.rpc('clear_driver_push_token'); } catch { /* best-effort */ }
}
