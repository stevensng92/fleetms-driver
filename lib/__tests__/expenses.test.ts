import { amountValue, checkExpense } from '../expenses';

describe('checkExpense', () => {
  it('needs an amount over zero', () => {
    expect(checkExpense('', 'v')).toEqual({ amount: 'Enter an amount greater than zero.' });
    expect(checkExpense('0', 'v')).toEqual({ amount: 'Enter an amount greater than zero.' });
    expect(checkExpense('-3', 'v')).toEqual({ amount: 'Enter an amount greater than zero.' });
  });
  it('says "12abc" is not numbers instead of reading it as 12', () => {
    expect(checkExpense('12abc', 'v')).toEqual({ amount: 'Enter the amount in numbers, like 45.50.' });
  });
  it('allows at most 2 decimals', () => {
    expect(checkExpense('1.505', 'v')).toEqual({ amount: 'Use at most 2 decimals.' });
  });
  it('needs a vehicle', () => {
    expect(checkExpense('45.5', null)).toEqual({ vehicle: 'Pick a vehicle for this expense.' });
  });
  it('reports the amount first and not the vehicle when both are missing', () => {
    expect(checkExpense('', null)).toEqual({ amount: 'Enter an amount greater than zero.' });
  });
  it('passes a good amount and a vehicle', () => {
    expect(checkExpense('45.5', 'v')).toEqual({});
  });
});

describe('amountValue', () => {
  it('is the number, or null when it is not one', () => {
    expect(amountValue('45.50')).toBe(45.5);
    expect(amountValue(' 12 ')).toBe(12);
    expect(amountValue('abc')).toBeNull();
    expect(amountValue('12abc')).toBeNull();
  });
});
