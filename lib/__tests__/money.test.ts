import { formatRM, splitRM } from '../money';

describe('formatRM', () => {
  it('always keeps the cents', () => {
    expect(formatRM(500)).toBe('RM 500.00');
    expect(formatRM(1234.5)).toBe('RM 1,234.50');
    expect(formatRM(0)).toBe('RM 0.00');
    expect(formatRM(80.05)).toBe('RM 80.05');
  });
});

describe('splitRM', () => {
  it('groups thousands and keeps cents apart', () => {
    expect(splitRM(1068)).toEqual({ whole: 'RM 1,068', cents: '.00' });
    expect(splitRM(1234.5)).toEqual({ whole: 'RM 1,234', cents: '.50' });
    expect(splitRM(0)).toEqual({ whole: 'RM 0', cents: '.00' });
  });
});
