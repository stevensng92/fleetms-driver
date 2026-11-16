import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import SetPin from '../../app/set-pin';
import { completeDriverPinSetup, signOut } from '../../lib/auth';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
jest.mock('../../lib/auth', () => ({
  completeDriverPinSetup: jest.fn(),
  signOut: jest.fn(),
}));

const EXPIRED = 'Your temporary PIN has expired. Ask your dispatcher to issue a new one.';

beforeEach(() => jest.clearAllMocks());

async function fillAndSave(pin = '123456', confirm = '123456') {
  await fireEvent.changeText(screen.getAllByPlaceholderText('••••••')[0], pin);
  await fireEvent.changeText(screen.getAllByPlaceholderText('••••••')[1], confirm);
  await fireEvent.press(screen.getByText('Save PIN'));
}

describe('Set PIN', () => {
  it('says the temporary PIN expired once, not twice', async () => {
    (completeDriverPinSetup as jest.Mock).mockResolvedValue({ ok: false, reason: 'expired', message: EXPIRED });
    await render(<SetPin/>);
    await fillAndSave();
    expect(await screen.findByText('Temporary PIN expired')).toBeTruthy();
    // The card's own line carries the message; no second copy in a red band.
    expect(screen.getByText(/no longer valid/)).toBeTruthy();
    expect(screen.queryByText(EXPIRED)).toBeNull();
    expect(screen.getByText('Sign out')).toBeTruthy();
  });

  // Value: protects=Sign out on the expired-PIN card signs the driver out and returns to sign-in; fails_when=the button stops calling signOut (so the push address is never cleared) or stops navigating; why_new=only the button's presence was tested; seam=none; no_claim=signOut's own push clear (lib/__tests__/auth.signOut.test.ts covers it)
  it('Sign out on the expired card signs out and returns to sign-in', async () => {
    const { router } = jest.requireMock('expo-router');
    (completeDriverPinSetup as jest.Mock).mockResolvedValue({ ok: false, reason: 'expired', message: EXPIRED });
    await render(<SetPin/>);
    await fillAndSave();
    await fireEvent.press(await screen.findByText('Sign out'));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('shows another error in a band', async () => {
    (completeDriverPinSetup as jest.Mock).mockResolvedValue({ ok: false, reason: 'unknown', message: 'Something broke.' });
    await render(<SetPin/>);
    await fillAndSave();
    expect(await screen.findByText('Something broke.')).toBeTruthy();
  });

  it('shows a mismatch at the confirm field and sends nothing', async () => {
    await render(<SetPin/>);
    await fireEvent.changeText(screen.getAllByPlaceholderText('••••••')[0], '123456');
    await fireEvent.changeText(screen.getAllByPlaceholderText('••••••')[1], '123457');
    expect(await screen.findByText("PINs don't match.")).toBeTruthy();
    await fireEvent.press(screen.getByText('Save PIN'));
    expect(completeDriverPinSetup).not.toHaveBeenCalled();
  });
});
