import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SignIn from '../../app/sign-in';
import { signInWithPin, fetchDriverProfile } from '../../lib/auth';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
// lib/auth builds a live Supabase client at import, so the screen test mocks it.
jest.mock('../../lib/auth', () => ({
  signInWithPin: jest.fn(),
  fetchDriverProfile: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

async function fill(phone: string, pin: string) {
  await fireEvent.changeText(screen.getByPlaceholderText('12-345 6789'), phone);
  await fireEvent.changeText(screen.getByPlaceholderText('••••••'), pin);
}

describe('Sign in', () => {
  it('has the button on from the start', async () => {
    await render(<SignIn/>);
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button.props.accessibilityState?.disabled).not.toBe(true);
  });

  it('says what is missing at each field and sends nothing', async () => {
    await render(<SignIn/>);
    await fireEvent.press(screen.getByText('Sign in'));
    expect(await screen.findByText('Enter your phone number.')).toBeTruthy();
    expect(screen.getByText('Enter your 6-digit PIN.')).toBeTruthy();
    expect(signInWithPin).not.toHaveBeenCalled();
  });

  it('says the PIN is short when it has fewer than 6 digits', async () => {
    await render(<SignIn/>);
    await fill('12-418 2290', '123');
    await fireEvent.press(screen.getByText('Sign in'));
    expect(await screen.findByText('Your PIN has 6 digits.')).toBeTruthy();
    expect(screen.queryByText('Enter your phone number.')).toBeNull();
    expect(signInWithPin).not.toHaveBeenCalled();
  });

  it('clears a field message when that field is edited', async () => {
    await render(<SignIn/>);
    await fireEvent.press(screen.getByText('Sign in'));
    await screen.findByText('Enter your phone number.');
    await fireEvent.changeText(screen.getByPlaceholderText('12-345 6789'), '12-418 2290');
    expect(screen.queryByText('Enter your phone number.')).toBeNull();
    expect(screen.getByText('Enter your 6-digit PIN.')).toBeTruthy();
  });

  it('signs in with a full form', async () => {
    (signInWithPin as jest.Mock).mockResolvedValue({ ok: true });
    (fetchDriverProfile as jest.Mock).mockResolvedValue({ kind: 'ok', profile: { driverId: 'd', pinSet: true } });
    await render(<SignIn/>);
    await fill('12-418 2290', '482913');
    await fireEvent.press(screen.getByText('Sign in'));
    await waitFor(() => expect(signInWithPin).toHaveBeenCalledWith('12-418 2290', '482913'));
  });

  it('keeps the wrong PIN message as the server words it', async () => {
    (signInWithPin as jest.Mock).mockResolvedValue({ ok: false, reason: 'invalid_credentials', message: 'Phone or PIN is incorrect.' });
    await render(<SignIn/>);
    await fill('12-418 2290', '000000');
    await fireEvent.press(screen.getByText('Sign in'));
    expect(await screen.findByText('Phone or PIN is incorrect.')).toBeTruthy();
  });

  it('shows the lockout minutes the server gave', async () => {
    (signInWithPin as jest.Mock).mockResolvedValue({ ok: false, reason: 'locked', message: 'Too many failed attempts. Try again in 7 minutes.', lockoutSeconds: 420 });
    await render(<SignIn/>);
    await fill('12-418 2290', '000000');
    await fireEvent.press(screen.getByText('Sign in'));
    expect(await screen.findByText('Too many failed attempts. Try again in 7 minutes.')).toBeTruthy();
  });
});
