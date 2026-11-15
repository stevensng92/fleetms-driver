/** What a typed amount is. The field's own message is picked from the kind by whoever checks the field. */
export type Amount =
  | { kind: 'blank' }
  | { kind: 'ok'; value: number }
  | { kind: 'negative' }
  | { kind: 'decimals' }
  | { kind: 'bad' };

// The whole text must be a number. parseFloat stops at the first stray
// character, so "12abc" used to be read as 12 and "1,50" as 1.
const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/** Reads a typed amount: blank, a number with at most 2 decimals, or the reason it is not one. */
export function parseAmount(text: string): Amount {
  const t = text.trim();
  if (!t) return { kind: 'blank' };
  if (!NUMBER.test(t)) return { kind: 'bad' };
  if (t.startsWith('-')) return { kind: 'negative' };
  const decimals = t.split('.')[1]?.length ?? 0;
  if (decimals > 2) return { kind: 'decimals' };
  return { kind: 'ok', value: Number(t) };
}
