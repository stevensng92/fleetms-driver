import { parseAmount } from './amount';

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
