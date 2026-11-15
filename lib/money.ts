// Ringgit figures. Cents are always kept: "RM 500.00", never "RM 500".

const grouped = (whole: number) => whole.toLocaleString('en-MY');

/** "RM 1,234.50". */
export function formatRM(amount: number): string {
  const { whole, cents } = splitRM(amount);
  return `${whole}${cents}`;
}

/** "RM 1,234" and ".50", so the cents can sit smaller beside the whole ringgit. */
export function splitRM(amount: number): { whole: string; cents: string } {
  const [w, c] = amount.toFixed(2).split('.');
  return { whole: `RM ${grouped(Number(w))}`, cents: `.${c}` };
}
