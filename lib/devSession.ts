import { supabase, supabaseConfigured } from './supabase';

// Dev shortcut: signs in silently as a test driver, so screens that depend on
// auth (RLS-protected queries) work without a real OTP flow. Remove this file
// when /sign-in is wired for real.
//
// Usage: call `ensureDevSession()` once at app boot (root layout effect).

const EMAIL = process.env.EXPO_PUBLIC_DEV_DRIVER_EMAIL;
const PASSWORD = process.env.EXPO_PUBLIC_DEV_DRIVER_PASSWORD;

export type DevSessionResult =
  | { kind: 'ok' }
  | { kind: 'no-config' }
  | { kind: 'no-creds' }
  | { kind: 'error'; message: string };

export async function ensureDevSession(): Promise<DevSessionResult> {
  if (!supabaseConfigured) return { kind: 'no-config' };

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return { kind: 'ok' };

  if (!EMAIL || !PASSWORD) return { kind: 'no-creds' };

  const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) return { kind: 'error', message: error.message };
  // Mirror the production /sign-in path: single-active-device policy. The
  // dev shortcut is the only place this used to silently leave concurrent
  // sessions around — fine for local dev, but trips the single-session
  // invariant when a developer hops between phones. Best-effort.
  try {
    await supabase.auth.signOut({ scope: 'others' });
  } catch { /* non-fatal */ }
  return { kind: 'ok' };
}
