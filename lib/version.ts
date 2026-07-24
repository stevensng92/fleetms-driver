// FleetMS Driver — app-version reporting.
//
// Reports the installed build's semver to the server on cold start, INDEPENDENT
// of push-notification registration.
//
// Before this, drivers.app_version was written only as a side effect of
// register_driver_push_token (lib/push.ts), which fires only after a push token
// is successfully minted. So a driver who declined the notification permission
// — or whose device never returns a token — showed "Not reported" in the
// dispatcher's Drivers panel forever, even after updating the app. This
// decouples the two: the version is reported whether or not push works.
//
// Fire-and-forget: best-effort, never blocks boot, swallows errors (the server
// RPC also no-ops for a non-active driver). Call once per cold start from the
// root layout after the session resolves — gated ONLY on the session, not on
// push permission or navigator readiness.

import Constants from 'expo-constants';
import { supabase } from './supabase';

// Cheap in-process dedup. Resets to null on every cold start, so an update
// (new binary => new expoConfig.version) is always re-reported at least once.
let reportedVersion: string | null = null;

export async function reportAppVersion(): Promise<void> {
  // expo-application isn't installed; expoConfig.version is the semver baked in
  // from app.json at build time, which is exactly the build the driver runs.
  const appVersion = Constants.expoConfig?.version ?? null;
  if (!appVersion || appVersion === reportedVersion) return;

  try {
    const { error } = await supabase.rpc('report_driver_app_version', {
      p_app_version: appVersion,
    });
    if (!error) reportedVersion = appVersion;
  } catch {
    // Network down, not signed in yet, RPC missing on an older backend — a
    // version ping is informational, so drop it silently and retry next boot.
  }
}
