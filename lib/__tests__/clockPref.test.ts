import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLOCK_KEY, getClockStyle, loadClockStyle, resetClockStyleForTests, setClockStyle, subscribeClockStyle } from '../clockPref';

// Change 33: the Time format setting is kept on the phone, like the theme.
beforeEach(async () => {
  await AsyncStorage.clear();
  resetClockStyleForTests();
});

describe('clock style setting', () => {
  it('is 24-hour until the driver chooses otherwise', () => {
    expect(getClockStyle()).toBe('24h');
  });
  it('changes at once, tells listeners, and is saved on the phone', async () => {
    const seen = jest.fn();
    const off = subscribeClockStyle(seen);
    setClockStyle('12h');
    expect(getClockStyle()).toBe('12h');
    expect(seen).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(await AsyncStorage.getItem(CLOCK_KEY)).toBe('12h');
    off();
    setClockStyle('24h');
    expect(seen).toHaveBeenCalledTimes(1);
  });
  it('does not tell listeners when the choice has not changed', () => {
    const seen = jest.fn();
    subscribeClockStyle(seen);
    setClockStyle('24h');
    expect(seen).not.toHaveBeenCalled();
  });
  it('loads the saved choice at start-up', async () => {
    await AsyncStorage.setItem(CLOCK_KEY, '12h');
    const seen = jest.fn();
    subscribeClockStyle(seen);
    await loadClockStyle();
    expect(getClockStyle()).toBe('12h');
    expect(seen).toHaveBeenCalledTimes(1);
  });
  it('stays 24-hour when nothing, or something odd, was saved', async () => {
    await loadClockStyle();
    expect(getClockStyle()).toBe('24h');
    await AsyncStorage.setItem(CLOCK_KEY, 'banana');
    await loadClockStyle();
    expect(getClockStyle()).toBe('24h');
  });
  it('keeps the choice for this visit when the phone cannot read or save it', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('no storage'));
    await loadClockStyle();
    expect(getClockStyle()).toBe('24h');
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('no storage'));
    setClockStyle('12h');
    await Promise.resolve();
    expect(getClockStyle()).toBe('12h');
  });
});
