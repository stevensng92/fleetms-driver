import { parseAmount } from '../amount';

describe('parseAmount', () => {
  it('blank when nothing or only spaces', () => {
    expect(parseAmount('')).toEqual({ kind: 'blank' });
    expect(parseAmount('   ')).toEqual({ kind: 'blank' });
  });
  it('reads a plain number, with spaces around it trimmed', () => {
    expect(parseAmount('45.50')).toEqual({ kind: 'ok', value: 45.5 });
    expect(parseAmount(' 12 ')).toEqual({ kind: 'ok', value: 12 });
    expect(parseAmount('.5')).toEqual({ kind: 'ok', value: 0.5 });
    expect(parseAmount('12.')).toEqual({ kind: 'ok', value: 12 });
  });
  it('does not read "12abc" as 12, or "1,50" as 1', () => {
    expect(parseAmount('12abc')).toEqual({ kind: 'bad' });
    expect(parseAmount('1,50')).toEqual({ kind: 'bad' });
    expect(parseAmount('abc')).toEqual({ kind: 'bad' });
    expect(parseAmount('1.2.3')).toEqual({ kind: 'bad' });
  });
  it('flags a negative number', () => {
    expect(parseAmount('-5')).toEqual({ kind: 'negative' });
  });
  it('flags more than 2 decimals', () => {
    expect(parseAmount('1.505')).toEqual({ kind: 'decimals' });
    expect(parseAmount('1.50')).toEqual({ kind: 'ok', value: 1.5 });
  });
});
