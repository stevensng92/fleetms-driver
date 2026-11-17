import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import Expenses from '../../app/(tabs)/expenses';
import { useMyExpenses } from '../../lib/queries/expenses';

// Value: protects=Expenses tab failed load shows the shared error box and Retry refetches; fails_when=LoadError wiring, its title or onRetry is dropped; why_new=no screen test exists for the Expenses tab; seam=none; no_claim=real query errors and the loaded list (hook mocked, only the failed state is covered)

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
// The query module builds a live Supabase client at import, so it is mocked.
jest.mock('../../lib/queries/expenses', () => ({ useMyExpenses: jest.fn() }));

function mockExpenses(over: Record<string, unknown>) {
  (useMyExpenses as jest.Mock).mockReturnValue({
    data: undefined, isLoading: false, isError: false, error: null,
    refetch: jest.fn(), isRefetching: false, ...over,
  });
}

beforeEach(() => jest.clearAllMocks());

describe('Expenses tab: failed load', () => {
  it('shows the error box with the plain sentence and Retry, and Retry reloads', async () => {
    const refetch = jest.fn();
    mockExpenses({ isError: true, error: new Error('Failed to fetch'), refetch });
    await render(<Expenses/>);
    expect(screen.getByText("Couldn't load expenses")).toBeTruthy();
    expect(screen.getByText('No signal. Check your connection and try again.')).toBeTruthy();
    expect(screen.queryByText('Failed to fetch')).toBeNull();
    expect(screen.queryByText('Logged this month')).toBeNull();
    await fireEvent.press(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('says something went wrong when the failure has no message', async () => {
    mockExpenses({ isError: true, error: null });
    await render(<Expenses/>);
    expect(screen.getByText('Something went wrong. Try again, or call dispatch if it keeps happening.')).toBeTruthy();
  });
});
