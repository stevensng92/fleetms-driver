import { driverSyntheticEmail, phoneChars, pinDigits, checkSignIn, checkPin } from '../phone';

describe('driverSyntheticEmail', () => {
  it('reads the same number the same way however it is typed', () => {
    expect(driverSyntheticEmail('012-418 2290')).toBe('driver-60124182290@fleetms.local');
    expect(driverSyntheticEmail('12-418 2290')).toBe('driver-60124182290@fleetms.local');
    expect(driverSyntheticEmail('+60 12-418 2290')).toBe('driver-60124182290@fleetms.local');
    expect(driverSyntheticEmail('0012-418 2290')).toBe('driver-60124182290@fleetms.local');
  });
});

describe('pinDigits', () => {
  it('keeps digits only, at most 6', () => {
    expect(pinDigits('48a29-13 77')).toBe('482913');
    expect(pinDigits('')).toBe('');
  });
});

describe('phoneChars', () => {
  it('keeps digits, spaces and dashes', () => {
    expect(phoneChars('12-418 2290x!')).toBe('12-418 2290');
    expect(phoneChars('+60 12')).toBe('60 12');
  });
});

describe('checkSignIn', () => {
  it('shows each missing field at its field', () => {
    expect(checkSignIn('', '')).toEqual({ phone: 'Enter your phone number.', pin: 'Enter your 6-digit PIN.' });
    expect(checkSignIn('12', '123')).toEqual({ phone: 'Enter the full number, like 12-345 6789.', pin: 'Your PIN has 6 digits.' });
  });
  it('checks the phone and the PIN on their own', () => {
    expect(checkSignIn('12-418 2290', '')).toEqual({ pin: 'Enter your 6-digit PIN.' });
    expect(checkSignIn('', '482913')).toEqual({ phone: 'Enter your phone number.' });
  });
  it('accepts 9 to 15 digits', () => {
    expect(checkSignIn('123456789', '482913')).toEqual({});
    expect(checkSignIn('12345678', '482913').phone).toBeDefined();
    expect(checkSignIn('123456789012345', '482913')).toEqual({});
    expect(checkSignIn('1234567890123456', '482913').phone).toBeDefined();
  });
  it('is clean for a full form', () => {
    expect(checkSignIn('12-418 2290', '482913')).toEqual({});
  });
});

describe('checkPin', () => {
  it('needs 6 digits that match', () => {
    expect(checkPin('123', '')).toEqual({ pin: 'Your PIN needs 6 digits.', confirm: 'Type the PIN again.' });
    expect(checkPin('123456', '123457')).toEqual({ confirm: "PINs don't match." });
    expect(checkPin('123456', '123456')).toEqual({});
  });
});
