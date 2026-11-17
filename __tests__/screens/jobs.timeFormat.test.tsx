import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JobsToday from '../../app/(tabs)/index';
import { resetClockStyleForTests, setClockStyle } from '../../lib/clockPref';
import { supabase } from '../../lib/supabase';
import { installFakeDatabase } from '../../test/fakeDatabase';

// The Jobs screen with the REAL jobs query and a real query cache. Only the
// Supabase client is swapped, for the demo's fake database (test/fakeDatabase.ts),
// and a pass-through spy counts how many times the jobs download runs. The Time
// format setting is a display choice: changing it redraws the cards and must
// not download the list again.

jest.mock('../../lib/supabase', () => require('../../test/fakeDatabase').supabaseModule);
installFakeDatabase();
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock('../../lib/mutations/jobActions', () => ({
  useConfirmAssignment: () => ({ mutateAsync: jest.fn() }),
  useRejectAssignment: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('../../lib/queries/notifications', () => ({ useUnreadCount: () => 0 }));
jest.mock('../../lib/queries/driverProfile', () => ({
  useDriverProfile: () => ({ data: { name: 'Aiman Razak' } }),
  fetchCommissionBaseline: () => Promise.resolve(null),
}));
jest.mock('../../lib/queries/appVersionConfig', () => ({ useAppVersionGate: () => ({ status: 'ok' }) }));

// The story's JOB-138 picks up at 14:30 Malaysian time today (Apex Events).
const downloads = (spy: jest.SpyInstance) => spy.mock.calls.filter(c => c[0] === 'assignments').length;

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={qc}><JobsToday/></QueryClientProvider>);
}

let from: jest.SpyInstance;
beforeEach(() => {
  resetClockStyleForTests();
  from = jest.spyOn(supabase, 'from');
});
afterEach(() => {
  from.mockRestore();
  resetClockStyleForTests();
});

describe('Jobs screen and the Time format setting', () => {
  it('switching the Time format changes the card times without downloading the jobs again', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('14:30')).toBeTruthy());
    expect(downloads(from)).toBe(1);

    await act(async () => { setClockStyle('12h'); });

    await waitFor(() => expect(screen.getByText('2:30 pm')).toBeTruthy());
    expect(screen.queryByText('14:30')).toBeNull();
    expect(screen.getAllByText('Apex Events').length).toBeGreaterThan(0); // the cards stay
    expect(downloads(from)).toBe(1);
  });
});
