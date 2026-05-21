import { supabase } from './supabase';

// =============================================================================
// Driver PIN auth — client helpers
//
// Drivers sign in with phone + 6-digit PIN. Under the hood we map phone to a
// deterministic synthetic email and call signInWithPassword. The synthetic
// email format is shared with the server-side RPC (private.driver_synthetic_email
// in migration 20260519000000_driver_pin_auth.sql) — keep these in lockstep.
//
// See docs/driver-pin-auth.md in the fleetms repo for the full design.
// =============================================================================

/**
 * Strip the input phone to digits-only and wrap in the synthetic format.
 * '+60 12-345 6789' → 'driver-60123456789@fleetms.local'
 *
 * MUST stay byte-equivalent to private.driver_synthetic_email in Postgres.
 */
// The sign-in screen has a hard-coded +60 country-code chip; users only type
// the local part. Prepend '60' if absent so the synthetic email matches what
// the dispatcher provisioned (drivers.phone is stored with country code, and
// private.driver_synthetic_email strips non-digits from it server-side).
// MY-only for now; revisit when we add tenants in other countries.
const COUNTRY_CODE = '60';

export function driverSyntheticEmail(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, '');
  // Drop leading zeros (Malaysian local convention: 0169343913 → 169343913).
  // Multi-zero defence: `^0+` instead of slicing once, so `00169...` collapses too.
  digits = digits.replace(/^0+/, '');
  // Prepend the country code if the user didn't paste a full international form.
  if (!digits.startsWith(COUNTRY_CODE)) digits = COUNTRY_CODE + digits;
  return `driver-${digits}@fleetms.local`;
}

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_credentials' | 'locked' | 'network' | 'unknown'; message: string; lockoutSeconds?: number };

/**
 * Sign in with phone + PIN. The PIN is the bcrypt password under the hood.
 * Supabase returns AuthApiError with status 400 + 'invalid_credentials' code
 * for both wrong phone and wrong PIN — we don't distinguish (avoids leaking
 * which phones are registered).
 *
 * On invalid_credentials we additionally call `note_failed_signin` to bump
 * the driver's failed-attempt counter. After 5 failures the server sets a
 * 15-min lockout and we surface 'locked' so the UI can show a countdown
 * instead of telling the user to keep guessing.
 */
export async function signInWithPin(phone: string, pin: string): Promise<SignInResult> {
  const email = driverSyntheticEmail(phone);
  const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
  if (!error) return { ok: true };

  // Supabase's AuthApiError has .code on newer versions; fall back to message match.
  const code = (error as { code?: string }).code;
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
    // Bump server-side failure counter. Returns {locked, lockout_seconds}.
    // Hard timeout — supabase-js can hang RPC calls immediately after a failed
    // signInWithPassword (auth-state resolution gets stuck waiting for token
    // refresh that never comes). We never let a best-effort write block the
    // sign-in UI; fall through to invalid-credentials if it doesn't return
    // in 2 seconds. The DB write still happens server-side; we just stop
    // waiting for the response.
    try {
      const rpcPromise = supabase.rpc('note_failed_signin', { p_phone: phone });
      const timeoutPromise = new Promise<{ data: null }>((resolve) =>
        setTimeout(() => resolve({ data: null }), 2000),
      );
      const { data } = await Promise.race([rpcPromise, timeoutPromise]) as { data: { locked?: boolean; lockout_seconds?: number } | null };
      const locked = data?.locked === true;
      const lockoutSeconds = data?.lockout_seconds ?? 0;
      if (locked) {
        const mins = Math.max(1, Math.ceil(lockoutSeconds / 60));
        return {
          ok: false, reason: 'locked',
          message: `Too many failed attempts. Try again in ${mins} ${mins === 1 ? 'minute' : 'minutes'}.`,
          lockoutSeconds,
        };
      }
    } catch {
      // Swallow — fall through to the normal invalid-credentials path.
    }
    return { ok: false, reason: 'invalid_credentials', message: 'Phone or PIN is incorrect.' };
  }
  if (/fetch|network|timed? out/i.test(error.message)) {
    return { ok: false, reason: 'network', message: 'Network error. Check your connection and try again.' };
  }
  return { ok: false, reason: 'unknown', message: error.message };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// -----------------------------------------------------------------------------
// Profile lookup — drives the session gate.
//   - 'no-row'  → no matching drivers row (deleted/never provisioned/RLS-hidden)
//   - 'error'   → transient query failure (network/Supabase outage) — caller
//                 should KEEP the session and retry, not boot the user out
//   - profile   → present + readable
// -----------------------------------------------------------------------------
export type DriverProfile = {
  driverId: string;
  pinSet: boolean;
};

export type FetchDriverProfileResult =
  | { kind: 'ok'; profile: DriverProfile }
  | { kind: 'no-row' }
  | { kind: 'error'; message: string };

export async function fetchDriverProfile(): Promise<FetchDriverProfileResult> {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, pin_set')
    .maybeSingle();
  if (error) return { kind: 'error', message: error.message };
  if (!data)  return { kind: 'no-row' };
  return { kind: 'ok', profile: { driverId: data.id, pinSet: data.pin_set } };
}

// -----------------------------------------------------------------------------
// completeDriverPinSetup — wraps the RPC of the same name. Distinguishes the
// expired-temp-PIN case from generic errors so /set-pin can show the right copy.
// -----------------------------------------------------------------------------
export type CompletePinSetupResult =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'invalid' | 'unknown'; message: string };

export async function completeDriverPinSetup(newPin: string): Promise<CompletePinSetupResult> {
  if (!/^[0-9]{6}$/.test(newPin)) {
    return { ok: false, reason: 'invalid', message: 'PIN must be exactly 6 digits.' };
  }
  const { error } = await supabase.rpc('complete_driver_pin_setup', { p_new_pin: newPin });
  if (!error) return { ok: true };

  // Postgres sqlstate is in error.code on supabase-js.
  if (error.code === 'P0001' || /expired/i.test(error.message)) {
    return { ok: false, reason: 'expired', message: 'Your temporary PIN has expired. Ask your dispatcher to issue a new one.' };
  }
  if (error.code === '22023') {
    return { ok: false, reason: 'invalid', message: 'PIN must be exactly 6 digits.' };
  }
  return { ok: false, reason: 'unknown', message: error.message };
}
