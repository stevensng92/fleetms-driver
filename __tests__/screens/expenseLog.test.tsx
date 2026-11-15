import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import LogExpense from '../../app/expenses/log';
import { useMyVehicles } from '../../lib/queries/vehicles';
import { useLogExpense } from '../../lib/mutations/logExpense';

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
