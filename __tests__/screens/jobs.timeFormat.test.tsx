import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JobsToday from '../../app/(tabs)/index';
import { resetClockStyleForTests, setClockStyle } from '../../lib/clockPref';
import { myStartOfDay } from '../../lib/timeFormat';

// The Jobs screen with the REAL jobs query and a real query cache. Only the
// Supabase client is mocked, so the test can count how many times the jobs
// download runs. The Time format setting is a display choice: changing it
// redraws the cards and must not download the list again.

const mockDownload = jest.fn();
jest.mock('../../lib/supabase', () => {
  const chain: any = {};
  for (const m of ['from', 'select', 'eq', 'or']) chain[m] = () => chain;
  chain.order = () => Promise.resolve(mockDownload());
  return { supabase: chain };
});
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

// 14:30 Malaysian time today, from the real clock (TESTING.md: never freeze Date).
const pickup = new Date(myStartOfDay(new Date()).getTime() + (14 * 60 + 30) * 60_000).toISOString();
const row = {
  id: 'asg-1', vehicle: { plate_number: 'WXY 1234' },
  jobs: {
    id: 'uuid-1', job_number: 'JOB-1', pickup_datetime: pickup, pickup_location: 'KLIA', dropoff_location: 'Bukit Bintang',
    client_name: 'Client JOB-1', pax: 2, status: 'confirmed', commission_rate_override: null, commission_fixed_amount: null,
  },
};

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={qc}><JobsToday/></QueryClientProvider>);
}

beforeEach(() => {
  resetClockStyleForTests();
  mockDownload.mockReset();
  mockDownload.mockReturnValue({ data: [row], error: null });
});
afterEach(() => resetClockStyleForTests());

describe('Jobs screen and the Time format setting', () => {
  it('switching the Time format changes the card times without downloading the jobs again', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('14:30')).toBeTruthy());
    expect(mockDownload).toHaveBeenCalledTimes(1);

    await act(async () => { setClockStyle('12h'); });

    await waitFor(() => expect(screen.getByText('2:30 pm')).toBeTruthy());
    expect(screen.queryByText('14:30')).toBeNull();
    expect(screen.getByText('Client JOB-1')).toBeTruthy();
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });
});
