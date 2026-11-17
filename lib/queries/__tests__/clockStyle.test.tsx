import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Change 33: job cards and notification rows build their times inside query
// functions, so a change to the Time format setting must make those queries run
// again. supabase is mocked so importing them builds no live client (AGENTS.md).
const mockResult = jest.fn();
jest.mock('../../supabase', () => {
  const chain: any = {};
  for (const m of ['from', 'select', 'eq', 'or']) chain[m] = () => chain;
  chain.order = () => Object.assign(Promise.resolve(mockResult()), { limit: () => Promise.resolve(mockResult()) });
  return { supabase: chain };
});
jest.mock('../driverProfile', () => ({ fetchCommissionBaseline: () => Promise.resolve(null) }));

import { useTodaysJobs, fetchJobs } from '../jobs';
import { useNotifications } from '../notifications';
import { resetClockStyleForTests, setClockStyle } from '../../clockPref';
import { formatClock, formatDateTime } from '../../timeFormat';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return Wrapper;
}

beforeEach(() => {
  resetClockStyleForTests();
  mockResult.mockReset();
});

describe('fetchJobs', () => {
  const pickup = new Date().toISOString();
  const row = {
    id: 'asg-1', vehicle: { plate_number: 'WXY 1234' },
    jobs: { id: 'u1', job_number: 'J1', pickup_datetime: pickup, pickup_location: 'A', dropoff_location: 'B', client_name: 'C', pax: 1, status: 'pending', commission_rate_override: null, commission_fixed_amount: null },
  };
  it('writes the card time in the style it is given, 24-hour by default', async () => {
    mockResult.mockReturnValue({ data: [row], error: null });
    expect((await fetchJobs()).today[0].time).toBe(formatClock(pickup, '24h'));
    expect((await fetchJobs('12h')).today[0].time).toBe(formatClock(pickup, '12h'));
    expect(formatClock(pickup, '12h')).toMatch(/ (am|pm)$/);
  });
});

describe('useTodaysJobs', () => {
  // The cards format their own time, so the setting is a display choice only:
  // switching it keeps the cached list and downloads nothing.
  it('does not download the jobs again when the setting changes', async () => {
    const pickup = new Date().toISOString();
    mockResult.mockReturnValue({ data: [{
      id: 'asg-1', vehicle: { plate_number: 'WXY 1234' },
      jobs: { id: 'u1', job_number: 'J1', pickup_datetime: pickup, pickup_location: 'A', dropoff_location: 'B', client_name: 'C', pax: 1, status: 'pending', commission_rate_override: null, commission_fixed_amount: null },
    }], error: null });
    const { result } = await renderHook(() => useTodaysJobs(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const before = result.current.data;
    const calls = mockResult.mock.calls.length;
    await act(async () => { setClockStyle('12h'); });
    expect(result.current.data).toBe(before);
    expect(mockResult.mock.calls.length).toBe(calls);
  });
});

describe('useNotifications', () => {
  it('shows the new time in the notification text after the setting changes', async () => {
    const when = '2026-12-12T01:22:00Z';
    mockResult.mockReturnValue({ data: [{
      id: 'n1', kind: 'pickup_reminder', enqueued_at: when, sent_at: null, read_at: null,
      payload: { job_number: 'JOB-1', pickup_location: 'KLIA', pickup_datetime: when },
    }], error: null });
    const { result } = await renderHook(() => useNotifications(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.[0].body).toBe('KLIA, 12 Dec, 09:22'));
    await act(async () => { setClockStyle('12h'); });
    await waitFor(() => expect(result.current.data?.[0].body).toBe('KLIA, 12 Dec, 9:22 am'));
    expect(formatDateTime(when, { weekday: false }, '12h')).toBe('12 Dec, 9:22 am');
  });
});
