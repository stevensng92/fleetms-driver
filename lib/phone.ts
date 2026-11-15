// Pure phone and PIN helpers for the sign-in and set-PIN screens. They live
// here, not in lib/auth.ts, because auth.ts builds a live database client when
// it is imported and so can't be tested directly.

// The sign-in screen has a hard-coded +60 country-code chip; users only type
// the local part. Prepend '60' if absent so the synthetic email matches what
// the dispatcher provisioned (drivers.phone is stored with country code, and
// private.driver_synthetic_email strips non-digits from it server-side).
// MY-only for now; revisit when we add tenants in other countries.
const COUNTRY_CODE = '60';

/**
 * Strip the input phone to digits-only and wrap in the synthetic format.
 * '+60 12-345 6789' → 'driver-60123456789@fleetms.local'
 *
 * MUST stay byte-equivalent to private.driver_synthetic_email in Postgres.
 */
export function driverSyntheticEmail(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, '');
  // Drop leading zeros (Malaysian local convention: 0169343913 → 169343913).
  // Multi-zero defence: `^0+` instead of slicing once, so `00169...` collapses too.
  digits = digits.replace(/^0+/, '');
  // Prepend the country code if the user didn't paste a full international form.
  if (!digits.startsWith(COUNTRY_CODE)) digits = COUNTRY_CODE + digits;
  return `driver-${digits}@fleetms.local`;
}

/** A PIN field takes digits only, six at most. */
export const pinDigits = (raw: string): string => raw.replace(/\D/g, '').slice(0, 6);

/** The phone field keeps digits, spaces and dashes; the "+60" is shown beside it, not typed. */
export const phoneChars = (raw: string): string => raw.replace(/[^\d\s-]/g, '');

export type SignInErrors = { phone?: string; pin?: string };

/**
 * The field checks for sign in. The button is always on; pressing it with a
 * bad field says what is missing at that field. An empty result means both
 * fields are fine and the real sign-in can go ahead.
 */
export function checkSignIn(phone: string, pin: string): SignInErrors {
  const errors: SignInErrors = {};
  const digits = phone.replace(/\D/g, '');
  if (!digits) errors.phone = 'Enter your phone number.';
  else if (digits.length < 9 || digits.length > 15) errors.phone = 'Enter the full number, like 12-345 6789.';
  if (!pin) errors.pin = 'Enter your 6-digit PIN.';
  else if (!/^\d{6}$/.test(pin)) errors.pin = 'Your PIN has 6 digits.';
  return errors;
}

/** The set-PIN checks: six digits, and the second box matches the first. */
export function checkPin(pin: string, confirm: string): { pin?: string; confirm?: string } {
  const out: { pin?: string; confirm?: string } = {};
  if (!/^\d{6}$/.test(pin)) out.pin = 'Your PIN needs 6 digits.';
  if (!confirm) out.confirm = 'Type the PIN again.';
  else if (confirm !== pin) out.confirm = "PINs don't match.";
  return out;
}
