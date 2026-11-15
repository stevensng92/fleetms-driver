import React from 'react';
import { Alert } from 'react-native';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import LogExpense from '../../app/expenses/log';
import { useMyVehicles } from '../../lib/queries/vehicles';
import { useLogExpense } from '../../lib/mutations/logExpense';
import * as ImagePicker from 'expo-image-picker';

// Screen tests must not live under app/ (see the note in earnings.test.tsx).

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
// The real modules build a Supabase client at import time.
jest.mock('../../lib/queries/vehicles', () => ({ useMyVehicles: jest.fn() }));
jest.mock('../../lib/mutations/logExpense', () => ({ useLogExpense: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

const VEHICLES = [
  { id: 'v1', plateNumber: 'VKA 2231', type: 'mpv', model: 'Toyota Alphard', capacity: 6, isDefault: true },
  { id: 'v2', plateNumber: 'WXY 1', type: 'sedan_executive', model: null, capacity: 3, isDefault: false },
];

const mutateAsync = jest.fn();

function mockVehicles(data: unknown[] | undefined, isLoading = false) {
  (useMyVehicles as jest.Mock).mockReturnValue({ data, isLoading });
}

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mutateAsync.mockResolvedValue({ id: 'e1', receiptPath: null });
  (useLogExpense as jest.Mock).mockReturnValue({ mutateAsync, isPending: false });
  mockVehicles(VEHICLES);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => alertSpy.mockRestore());

describe('Log expense: errors sit at the field (28a)', () => {
  it('a blank amount says so under the Amount field, with no pop-up and no save', async () => {
    await render(<LogExpense/>);
    await fireEvent.press(screen.getByText('Save expense'));

    expect(screen.getByText('Enter an amount greater than zero.')).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('"12abc" is not read as 12', async () => {
    await render(<LogExpense/>);
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '12abc');
    await fireEvent.press(screen.getByText('Save expense'));

    expect(screen.getByText('Enter the amount in numbers, like 45.50.')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('more than 2 decimals is refused at the field', async () => {
    await render(<LogExpense/>);
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '1.505');
    await fireEvent.press(screen.getByText('Save expense'));

    expect(screen.getByText('Use at most 2 decimals.')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('a missing vehicle says so under the Vehicle field, with no pop-up', async () => {
    mockVehicles([]);
    await render(<LogExpense/>);
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '5');
    await fireEvent.press(screen.getByText('Save expense'));

    expect(screen.getByText('Pick a vehicle for this expense.')).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('typing in the amount clears its message', async () => {
    await render(<LogExpense/>);
    await fireEvent.press(screen.getByText('Save expense'));
    expect(screen.getByText('Enter an amount greater than zero.')).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '4');
    expect(screen.queryByText('Enter an amount greater than zero.')).toBeNull();
  });

  it('a good form saves the typed number and goes back', async () => {
    await render(<LogExpense/>);
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), ' 45.50 ');
    await fireEvent.press(screen.getByText('Save expense'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ category: 'fuel', amount: 45.5, vehicleId: 'v1' });
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('a failed save still uses a pop-up (this is not a field problem)', async () => {
    mutateAsync.mockRejectedValue(new Error('boom'));
    await render(<LogExpense/>);
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '5');
    await fireEvent.press(screen.getByText('Save expense'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Could not save', 'boom'));
  });
});

/** Taps "Add receipt" and chooses an option from the (mocked) pop-up menu. */
async function chooseFromLibrary() {
  await fireEvent.press(screen.getByText('Take photo or upload'));
  const buttons = alertSpy.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  await act(async () => { await buttons.find(b => b.text === 'From library')!.onPress!(); });
}

function mockPick(asset: Record<string, unknown>) {
  (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [asset] });
}

describe('Log expense: the receipt is really checked (28b)', () => {
  it('refuses a file that is not a JPG or PNG, at the Receipt field', async () => {
    mockPick({ uri: 'file:///r.pdf', mimeType: 'application/pdf', fileSize: 1000 });
    await render(<LogExpense/>);
    await chooseFromLibrary();

    await waitFor(() => expect(screen.getByText('Choose a JPG or PNG photo.')).toBeTruthy());
    // No photo was kept: the drop zone is still showing.
    expect(screen.getByText('Take photo or upload')).toBeTruthy();
  });

  it('refuses a photo over 10 MB', async () => {
    mockPick({ uri: 'file:///big.jpg', mimeType: 'image/jpeg', fileSize: 10 * 1024 * 1024 + 1 });
    await render(<LogExpense/>);
    await chooseFromLibrary();

    await waitFor(() => expect(screen.getByText('This photo is over 10 MB. Choose a smaller one.')).toBeTruthy());
  });

  it('keeps a good photo and clears an earlier message', async () => {
    mockPick({ uri: 'file:///r.pdf', mimeType: 'application/pdf', fileSize: 1000 });
    await render(<LogExpense/>);
    await chooseFromLibrary();
    await waitFor(() => expect(screen.getByText('Choose a JPG or PNG photo.')).toBeTruthy());

    mockPick({ uri: 'file:///ok.jpg', mimeType: 'image/jpeg', fileSize: 1000 });
    await chooseFromLibrary();

    await waitFor(() => expect(screen.queryByText('Choose a JPG or PNG photo.')).toBeNull());
    expect(screen.queryByText('Take photo or upload')).toBeNull();
  });
});

describe('Log expense: the vehicle list (28c)', () => {
  it('shows "MPV, Toyota Alphard", not the raw type', async () => {
    await render(<LogExpense/>);
    await fireEvent.press(screen.getByText('VKA 2231'));

    expect(screen.getByText('MPV, Toyota Alphard')).toBeTruthy();
    expect(screen.getByText('Executive')).toBeTruthy();
    expect(screen.queryByText(/sedan_executive/)).toBeNull();
    expect(screen.queryByText(/^mpv/)).toBeNull();
  });

  it('an empty list says so and does not spin', async () => {
    mockVehicles([]);
    await render(<LogExpense/>);
    await fireEvent.press(screen.getByText('Pick vehicle'));

    expect(screen.getByText('No active vehicles in your org.')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('while the list is loading the button says so and cannot be opened', async () => {
    mockVehicles(undefined, true);
    await render(<LogExpense/>);

    expect(screen.getByText('Loading…')).toBeTruthy();
    await fireEvent.press(screen.getByText('Loading…'));
    expect(screen.queryByText('No active vehicles in your org.')).toBeNull();
  });
});
