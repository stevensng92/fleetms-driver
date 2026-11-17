import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import Receipt from '../../app/expenses/[id]';

// Screen tests live here, not under app/ (see earnings.test.tsx for why).
// RNTL v14: `render` and `fireEvent` are async.

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'exp-1' }),
}));
jest.mock('../../lib/queries/expenses', () => ({
  getSignedReceiptUrl: jest.fn(async () => null),
}));

// What the database answers for one lookup: `.single()` and `.maybeSingle()`
// answer differently when no row matches, as the real client does.
type Answer = { row: unknown } | { fail: string };
const answers: Answer[] = [];
const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));

function lookup() {
  const answer = answers.shift() ?? { row: null };
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: async () => 'fail' in answer
      ? { data: null, error: { message: answer.fail } }
      : answer.row === null
        ? { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } }
        : { data: answer.row, error: null },
    maybeSingle: async () => 'fail' in answer
      ? { data: null, error: { message: answer.fail } }
      : { data: answer.row, error: null },
  };
  return chain;
}

const ROW = {
  id: 'exp-1', category: 'fuel', amount: '42.50', expense_date: '2026-11-03',
  receipt_path: null, notes: null, voided_at: null, status: 'pending',
  vehicle: { plate_number: 'VKA 2231' },
};

async function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}><Receipt/></QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  answers.length = 0;
  mockFrom.mockImplementation(lookup);
});

describe('Receipt screen', () => {
  it('shows the expense once it loads', async () => {
    answers.push({ row: ROW });
    await open();
    expect(await screen.findByText('Fuel receipt')).toBeTruthy();
  });

  it('offers Retry when the expense fails to load, and Retry loads it', async () => {
    answers.push({ fail: 'Failed to fetch' }, { row: ROW });
    await open();
    expect(await screen.findByText("Couldn't load expense")).toBeTruthy();
    expect(screen.getByText('Failed to fetch')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    expect(await screen.findByText('Fuel receipt')).toBeTruthy();
  });

  it('says the expense is gone, not a database error, when it no longer exists', async () => {
    answers.push({ row: null });
    await open();
    expect(await screen.findByText('This expense is no longer on your list')).toBeTruthy();
    expect(screen.queryByText(/JSON object requested/)).toBeNull();
    expect(screen.queryByText('Retry')).toBeNull();
    await fireEvent.press(screen.getByText('Back to expenses'));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/expenses');
  });
});
