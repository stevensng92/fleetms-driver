import { parseAmount } from './amount';
import { vehicleTypeLabel } from './route';

// Plain decisions about the expense form, kept apart from the screen so they
// can be tested without a database client. Ported from the design mock's
// expensesRules.ts and rules.ts, adapted to the real data shapes.

/** The typed amount as a number, or null when it is not one. */
export function amountValue(text: string): number | null {
  const a = parseAmount(text);
  return a.kind === 'ok' ? a.value : null;
}

/**
 * The messages that belong under the Amount and Vehicle fields. Empty object
 * means the form is good. The amount is judged first; the vehicle message only
 * shows once the amount is fine, so the driver fixes one thing at a time.
 */
export function checkExpense(amount: string, vehicleId: string | null): { amount?: string; vehicle?: string } {
  const a = parseAmount(amount);
  const out: { amount?: string; vehicle?: string } = {};
  if (a.kind === 'blank' || a.kind === 'negative' || (a.kind === 'ok' && a.value <= 0)) {
    out.amount = 'Enter an amount greater than zero.';
  } else if (a.kind === 'bad') {
    out.amount = 'Enter the amount in numbers, like 45.50.';
  } else if (a.kind === 'decimals') {
    out.amount = 'Use at most 2 decimals.';
  }
  if (!out.amount && !vehicleId) out.vehicle = 'Pick a vehicle for this expense.';
  return out;
}

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/** The words under the Receipt field when a chosen file will not do; null when it is fine. */
export function checkReceiptFile(f: { type: string; size: number }): string | null {
  if (f.type !== 'image/jpeg' && f.type !== 'image/png') return 'Choose a JPG or PNG photo.';
  if (f.size > MAX_RECEIPT_BYTES) return 'This photo is over 10 MB. Choose a smaller one.';
  return null;
}

const TYPE_BY_ENDING: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

/**
 * What the image picker handed back, as the kind and size checkReceiptFile
 * wants. When the picker names no type, the file ending decides; a type we
 * cannot tell comes back empty so the check refuses it. A missing size counts
 * as 0 (nothing to measure).
 */
export function receiptFileOf(asset: { uri: string; mimeType?: string | null; fileSize?: number | null }): { type: string; size: number } {
  const ending = asset.uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return { type: asset.mimeType ?? TYPE_BY_ENDING[ending] ?? '', size: asset.fileSize ?? 0 };
}

/**
 * The second line of a vehicle in the picker: "MPV, Toyota Alphard". The type
 * name comes from the one list in lib/route.ts, so "sedan_executive" never
 * reaches the screen. No model means just the type name.
 */
export function vehicleOptionLine(v: { type: string; model: string | null }): string {
  const model = v.model?.trim();
  return model ? `${vehicleTypeLabel(v.type)}, ${model}` : vehicleTypeLabel(v.type);
}
