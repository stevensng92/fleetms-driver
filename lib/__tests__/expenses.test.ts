import { amountValue, checkExpense, checkReceiptFile, receiptFileOf, vehicleOptionLine } from '../expenses';

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

describe('checkReceiptFile', () => {
  const TEN_MB = 10 * 1024 * 1024;
  it('takes a JPG or PNG up to 10 MB', () => {
    expect(checkReceiptFile({ type: 'image/jpeg', size: 2_000_000 })).toBeNull();
    expect(checkReceiptFile({ type: 'image/png', size: TEN_MB })).toBeNull();
  });
  it('refuses any other kind of file', () => {
    expect(checkReceiptFile({ type: 'application/pdf', size: 1 })).toBe('Choose a JPG or PNG photo.');
    expect(checkReceiptFile({ type: 'image/heic', size: 1 })).toBe('Choose a JPG or PNG photo.');
    expect(checkReceiptFile({ type: '', size: 1 })).toBe('Choose a JPG or PNG photo.');
  });
  it('refuses a file over 10 MB', () => {
    expect(checkReceiptFile({ type: 'image/jpeg', size: TEN_MB + 1 })).toBe('This photo is over 10 MB. Choose a smaller one.');
  });
  it('checks the kind before the size', () => {
    expect(checkReceiptFile({ type: 'application/pdf', size: TEN_MB + 1 })).toBe('Choose a JPG or PNG photo.');
  });
});

describe('receiptFileOf', () => {
  it('uses the type and size the picker reports', () => {
    expect(receiptFileOf({ uri: 'file:///a', mimeType: 'image/png', fileSize: 5 })).toEqual({ type: 'image/png', size: 5 });
  });
  it('falls back to the file ending when the picker gives no type', () => {
    expect(receiptFileOf({ uri: 'file:///a/b.JPG' })).toEqual({ type: 'image/jpeg', size: 0 });
    expect(receiptFileOf({ uri: 'file:///a/b.jpeg?x=1' })).toEqual({ type: 'image/jpeg', size: 0 });
    expect(receiptFileOf({ uri: 'file:///a/b.png' })).toEqual({ type: 'image/png', size: 0 });
  });
  it('leaves the type empty when it cannot be told, so the check refuses it', () => {
    expect(receiptFileOf({ uri: 'file:///a/b.heic' })).toEqual({ type: '', size: 0 });
  });
});

describe('vehicleOptionLine', () => {
  it('is the type name, then the model', () => {
    expect(vehicleOptionLine({ type: 'mpv', model: 'Toyota Alphard' })).toBe('MPV, Toyota Alphard');
    expect(vehicleOptionLine({ type: 'sedan_executive', model: 'Mercedes E-Class' })).toBe('Executive, Mercedes E-Class');
  });
  it('is just the type name when there is no model', () => {
    expect(vehicleOptionLine({ type: 'van', model: null })).toBe('Van');
    expect(vehicleOptionLine({ type: 'van', model: '  ' })).toBe('Van');
  });
  it('passes a type we do not know through unchanged', () => {
    expect(vehicleOptionLine({ type: 'bus', model: 'Yutong' })).toBe('bus, Yutong');
  });
});
