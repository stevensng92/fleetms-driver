// FleetMS Driver — push notification setup.
//
// Single entry-point: `ensurePushNotifications(router)`.
//
//   1. Asks for permission (idempotent — system remembers the answer)
//   2. Wires a tap-response listener (handlePushTap), once permission is
//      granted, whatever happens with the token below
//   3. Fetches the Expo push token
//   4. Calls register_driver_push_token(token) RPC on Supabase
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
import { queryClient } from './queryClient';
import { readPushTap } from './notification';

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

  // Tap-response listener, wired before the token work below so a failed
  // token fetch or save never leaves pushes already on the phone dead to a
  // tap. Wire once per ensurePushNotifications() call.
  if (responseSub) {
    responseSub.remove();
    responseSub = null;
  }
  responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    void handlePushTap(response.notification.request.content.data, router);
  });

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

  return { kind: 'ok', token };
}

/**
 * A tapped push: open where it leads (an allowed link, else the Notifications
 * screen), then mark its Notifications screen row read so the badge drops.
 * The open comes first and a failed mark is swallowed: a network blip must
 * never keep a driver from the job. Exported for tests.
 */
export async function handlePushTap(data: unknown, router: Pick<Router, 'push'>): Promise<void> {
  const { link, rowId } = readPushTap(data);
  router.push(link as any);
  if (!rowId) return;
  try {
    const { error } = await supabase.rpc('mark_notifications_read', { p_ids: [rowId] });
    if (!error) await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  } catch { /* best-effort: the job is already open */ }
}

/**
 * Forget the push address this phone last saved, so the next sign-in saves it
 * again. The root layout calls it on every sign-out it sees, including ones
 * that skip the Sign out button (session expired, or signed out because the
 * driver signed in on another phone): otherwise the same-address check would
 * skip the save and the next driver on this phone would get no job alerts.
 */
export function resetPushRegistration() {
  registeredToken = null;
}

// Call on sign-out to drop the token server-side so the driver stops
// receiving alerts on this device.
export async function clearPushNotifications() {
  resetPushRegistration();
  if (responseSub) { responseSub.remove(); responseSub = null; }
  try { await supabase.rpc('clear_driver_push_token'); } catch { /* best-effort */ }
}
