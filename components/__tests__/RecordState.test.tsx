import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { RecordState } from '../RecordState';

// NOTE: RNTL v14's `render` and `fireEvent` are async. Always await them.

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

const notFound = {
  title: 'This expense is no longer on your list',
  body: 'It may have been removed.',
  actionLabel: 'Back to expenses',
  to: '/(tabs)/expenses',
} as const;

function show(query: { data: unknown; isError?: boolean; error?: unknown; refetch?: () => void }) {
  return render(
    <RecordState
      title="Receipt"
      errorTitle="Couldn't load expense"
      notFound={notFound}
      query={{ isError: false, error: null, refetch: jest.fn(), ...query }}
    />,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('RecordState', () => {
  it('shows the header and a spinner while the record loads', async () => {
    await show({ data: undefined });
    expect(screen.getByText('Receipt')).toBeTruthy();
    expect(screen.getByTestId('record-loading')).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();
    expect(screen.queryByText(notFound.title)).toBeNull();
  });

  it('shows the error box when loading failed, and Retry reloads', async () => {
    const refetch = jest.fn();
    await show({ data: undefined, isError: true, error: new Error('Failed to fetch'), refetch });
    expect(screen.getByText("Couldn't load expense")).toBeTruthy();
    expect(screen.getByText('Failed to fetch')).toBeTruthy();
    expect(screen.queryByTestId('record-loading')).toBeNull();
    await fireEvent.press(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('says "Unknown error" when the failure has no message', async () => {
    await show({ data: undefined, isError: true, error: null });
    expect(screen.getByText('Unknown error')).toBeTruthy();
  });

  it('says the record is gone when the load found nothing, with a way back', async () => {
    await show({ data: null });
    expect(screen.getByText(notFound.title)).toBeTruthy();
    expect(screen.getByText(notFound.body)).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();
    expect(screen.queryByTestId('record-loading')).toBeNull();
    await fireEvent.press(screen.getByText('Back to expenses'));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/expenses');
  });

  it('shows the error, not "gone", when a retry after not-found fails', async () => {
    await show({ data: null, isError: true, error: new Error('Failed to fetch') });
    expect(screen.getByText("Couldn't load expense")).toBeTruthy();
    expect(screen.queryByText(notFound.title)).toBeNull();
  });

  it('goes back from the header', async () => {
    await show({ data: undefined });
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(router.back).toHaveBeenCalled();
  });
});
