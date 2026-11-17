import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Profile from '../../app/(tabs)/profile';
import { useDriverProfile, type DriverProfile } from '../../lib/queries/driverProfile';
import { useDriverTimeOff } from '../../lib/queries/timeOff';
import { useCancelTimeOff } from '../../lib/mutations/timeOff';
import { useAppVersionGate } from '../../lib/queries/appVersionConfig';
import { signOut } from '../../lib/auth';
import { getClockStyle, resetClockStyleForTests } from '../../lib/clockPref';
import { entryDays, rangeLabel } from '../../lib/timeOff';
import { makeTokens } from '../../theme/tokens';

// RNTL v14: render and fireEvent are async; await every one.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
// These modules build a live Supabase client at import, so they are mocked.
jest.mock('../../lib/queries/driverProfile', () => ({ useDriverProfile: jest.fn() }));
jest.mock('../../lib/queries/timeOff', () => ({ useDriverTimeOff: jest.fn() }));
jest.mock('../../lib/mutations/timeOff', () => ({ useCancelTimeOff: jest.fn() }));
jest.mock('../../lib/queries/appVersionConfig', () => ({ useAppVersionGate: jest.fn() }));
jest.mock('../../lib/auth', () => ({ signOut: jest.fn() }));

const profile = (over: Partial<DriverProfile> = {}): DriverProfile => ({
  id: 'd1', name: 'Azman bin Yusof', initials: 'AB', phone: '+60 12-345 6789', licenseClass: 'D',
  availability: 'available', isActive: true, org: { name: 'Acme Fleet' },
  vehicle: { plate: 'WXY 1234', type: 'mpv', model: 'Alphard' }, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  resetClockStyleForTests();
  (useDriverProfile as jest.Mock).mockReturnValue({ data: profile(), isLoading: false });
  (useDriverTimeOff as jest.Mock).mockReturnValue({ data: [], isLoading: false, error: null });
  (useCancelTimeOff as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false, variables: undefined });
  (useAppVersionGate as jest.Mock).mockReturnValue({ status: 'ok' });
  (signOut as jest.Mock).mockResolvedValue(undefined);
});

describe('Profile identity (change 26)', () => {
  it('skips "bin" in the initials', async () => {
    await render(<Profile/>);
    expect(screen.getByText('AY')).toBeTruthy();
  });

  it('shows an inactive driver as Inactive, never on a green pill', async () => {
    (useDriverProfile as jest.Mock).mockReturnValue({ data: profile({ isActive: false, availability: 'available' }), isLoading: false });
    await render(<Profile/>);
    expect(screen.getByText('Inactive')).toBeTruthy();
    expect(screen.queryByText('Available')).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toContain(makeTokens('light').greenSoft);
  });

  it('shows an active driver as Available on a green pill', async () => {
    await render(<Profile/>);
    expect(screen.getByText('Available')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain(makeTokens('light').greenSoft);
  });
});

describe('Sign out (change 27)', () => {
  it('asks first and sends nothing until confirmed', async () => {
    await render(<Profile/>);
    expect(screen.queryByText('Sign out?')).toBeNull();
    await fireEvent.press(screen.getByText('Sign out'));
    expect(screen.getByText('Sign out?')).toBeTruthy();
    expect(screen.getByText("You'll need your phone number and PIN to sign in again.")).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('"Stay signed in" closes the question and signs nobody out', async () => {
    await render(<Profile/>);
    await fireEvent.press(screen.getByText('Sign out'));
    await fireEvent.press(screen.getByText('Stay signed in'));
    expect(signOut).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('confirming signs out and goes to sign-in', async () => {
    await render(<Profile/>);
    await fireEvent.press(screen.getByText('Sign out'));
    const buttons = screen.getAllByText('Sign out');
    await fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sign-in'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('Time format (change 33)', () => {
  it('sits under Theme with both choices, 24-hour chosen by default', async () => {
    await render(<Profile/>);
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByText('Time format')).toBeTruthy();
    expect(screen.getByText('24-hour')).toBeTruthy();
    expect(screen.getByText('12-hour')).toBeTruthy();
    expect(getClockStyle()).toBe('24h');
  });

  it('saves the 12-hour choice, and can go back', async () => {
    await render(<Profile/>);
    await fireEvent.press(screen.getByText('12-hour'));
    expect(getClockStyle()).toBe('12h');
    await fireEvent.press(screen.getByText('24-hour'));
    expect(getClockStyle()).toBe('24h');
  });
});

describe('Time off list', () => {
  // 10 days ahead, as the stored half-open range at Malaysian midnight.
  const startsAt = new Date(Date.now() + 10 * 86400000);
  const sMid = new Date(Math.floor((startsAt.getTime() + 8 * 3600000) / 86400000) * 86400000 - 8 * 3600000);
  const entry = {
    id: 't1', startsAt: sMid.toISOString(), endsAt: new Date(sMid.getTime() + 3 * 86400000).toISOString(),
    reason: 'leave', notes: null, status: 'pending', createdAt: sMid.toISOString(),
  };

  it('writes the dates with weekdays and the meta as "3 days, Leave"', async () => {
    (useDriverTimeOff as jest.Mock).mockReturnValue({ data: [entry], isLoading: false, error: null });
    await render(<Profile/>);
    const d = entryDays(entry.startsAt, entry.endsAt);
    expect(screen.getByText(rangeLabel(d.start, d.end))).toBeTruthy();
    expect(screen.getByText('3 days, Leave')).toBeTruthy();
  });
});

// A failed Withdraw shows the plain sentence, never the server's own text.
describe('Withdraw a time-off request: a failure shows plain words', () => {
  it("keeps the title and replaces the server's text", async () => {
    const startsAt = new Date(Date.now() + 10 * 86400000).toISOString();
    const entry = {
      id: 't1', startsAt, endsAt: new Date(Date.now() + 12 * 86400000).toISOString(),
      reason: 'leave', notes: null, status: 'pending', createdAt: startsAt,
    };
    (useDriverTimeOff as jest.Mock).mockReturnValue({ data: [entry], isLoading: false, error: null });
    (useCancelTimeOff as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue({ message: 'Not authorized', code: 'P0001' }),
      isPending: false, variables: undefined,
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      await render(<Profile/>);
      await fireEvent.press(screen.getByText('Withdraw'));
      // The first pop-up asks "Withdraw request?"; press its Withdraw button.
      const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => unknown }[];
      await buttons.find(b => b.text === 'Withdraw')!.onPress!();
      expect(alertSpy).toHaveBeenLastCalledWith('Could not withdraw', "This isn't available to you. Call dispatch if you think it should be.");
      expect(alertSpy).not.toHaveBeenCalledWith('Could not withdraw', 'Not authorized');
    } finally {
      alertSpy.mockRestore();
    }
  });
});
