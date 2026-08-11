// Who the driver calls, and whose number it actually is.
//
// The dispatcher resolves a LONGER version of this chain for its copied
// trip-details snippet (../fleetms/app/lib/job-contact.ts): passenger →
// billing client → `newClientPhone`. This module has the first two links only.
// The third is deliberately absent, not missing: `newClientPhone` is a
// pre-save form field on the dispatcher's job form, never a `jobs` column, so
// there is nothing for the driver side to read. If a future dispatcher change
// adds a real fourth source, this comment is the place that should stop being
// true — the two chains live in separate repos with no shared source.
//
// Kept in its own module with no `lib/supabase` import on the path, because
// anything that reaches that module builds a live client at import time and
// stops being unit-testable. See AGENTS.md.

export type ContactSource = 'passenger' | 'client';

export type JobContact = {
  phone: string | null;
  /** Whose number `phone` is. null when there is no number at all. Drives the
   *  "client's number" caption — a driver holding a passenger name needs to
   *  know the line they are about to dial answers to the booker instead. */
  source: ContactSource | null;
};

const NONE: JobContact = { phone: null, source: null };

/** Treat whitespace-only as absent. A legacy or imported row can carry '' in a
 *  phone column, and `??` would short-circuit on it and drop a real number
 *  further down the chain — `.trim() || next` skips blanks. */
function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * @param passengerPhone `jobs.passenger_phone` — the rider's own line.
 * @param clientPhone    billing client's number, or null when the job has no
 *                       billing client, the client has no number on file, or
 *                       the lookup failed (callers degrade rather than throw).
 */
export function resolveJobContact(
  passengerPhone: string | null | undefined,
  clientPhone: string | null | undefined,
): JobContact {
  const passenger = clean(passengerPhone);
  if (passenger) return { phone: passenger, source: 'passenger' };

  const client = clean(clientPhone);
  if (client) return { phone: client, source: 'client' };

  return NONE;
}

/**
 * Is this stored value safe to show a driver AND safe to dial?
 *
 * ONE predicate for both questions on purpose. The card used to validate only
 * on tap, which meant a value that failed the check still rendered verbatim in
 * the card body — a more trusted surface than the alert the check protected.
 * Neither `jobs.passenger_phone` nor `clients.normalized_phone` carries a CHECK
 * constraint and both are writable by dispatcher-role accounts, so the value is
 * untrusted text until this says otherwise.
 *
 * Deliberate details:
 *  - A literal space, NOT `\s`. `\s` matches `\n`, ` `, `　` and
 *    friends, so `"0312345678\n\n\n\n\n\n99"` would pass, render as a number
 *    with a stray `99` six lines below where the driver stops reading, and
 *    dial `031234567899`. Display and dial must not be able to disagree.
 *  - Must START with an optional `+`, an optional `(`, then a digit. That keeps
 *    `"(03) 1234-5678"` — a shape dispatchers really type — while rejecting
 *    `"-------1234567"` and anything else led by punctuation or prose.
 *  - Validated on the RAW value BEFORE any stripping. Strip-then-check hands
 *    the check a laundered string: `"+60123456789 ext 12"` becomes a
 *    valid-looking 13-digit number, and `"*21*60123456789#"` becomes a plain
 *    one — both would dial something never displayed.
 */
export function isDialable(phone: string | null | undefined): boolean {
  if (!phone) return false;
  if (!/^\+?\(?\d[\d ().-]{5,19}$/.test(phone)) return false;
  return /^\+?\d{7,15}$/.test(toDialString(phone));
}

/** The digits actually handed to `tel:`. Only ever call on an isDialable value. */
export function toDialString(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
