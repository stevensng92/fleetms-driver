import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import Receipt from '../../app/expenses/[id]';
import { installFakeDatabase } from '../../test/fakeDatabase';

// Screen tests live here, not under app/ (see earnings.test.tsx for why).
// RNTL v14: `render` and `fireEvent` are async.

let mockExpenseId = 'x1';
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: mockExpenseId }),
}));
jest.mock('../../lib/queries/expenses', () => ({
  getSignedReceiptUrl: jest.fn(async () => null),
}));

// The expense comes from the demo's fake database (test/fakeDatabase.ts): x1 is
// the story's fuel receipt. Failures come from the fake's `fail` rule.
jest.mock('../../lib/supabase', () => require('../../test/fakeDatabase').supabaseModule);
const fake = installFakeDatabase();

async function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}><Receipt/></QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExpenseId = 'x1';
});

describe('Receipt screen', () => {
  it('shows the expense once it loads', async () => {
    await open();
    expect(await screen.findByText('Fuel receipt')).toBeTruthy();
  });

  it('offers Retry when the expense fails to load, and Retry loads it', async () => {
    let reads = 0;
    fake.failWith(t => (t.name === 'expenses' && ++reads === 1 ? { message: 'Failed to fetch' } : undefined));
    await open();
    expect(await screen.findByText("Couldn't load expense")).toBeTruthy();
    expect(screen.getByText('Failed to fetch')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    expect(await screen.findByText('Fuel receipt')).toBeTruthy();
  });

  it('says the expense is gone, not a database error, when it no longer exists', async () => {
    mockExpenseId = 'no-such-expense';
    await open();
    expect(await screen.findByText('This expense is no longer on your list')).toBeTruthy();
    expect(screen.queryByText(/JSON object requested/)).toBeNull();
    expect(screen.queryByText('Retry')).toBeNull();
    await fireEvent.press(screen.getByText('Back to expenses'));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/expenses');
  });
});
