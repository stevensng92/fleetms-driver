import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Change 33, revised: job cards and notification rows format their own times on
// screen, so a change to the Time format setting must NOT run either query again.
// Runs on the demo's fake database (test/fakeDatabase.ts); a pass-through spy on
// the fake client counts how many times a query went to the database.
jest.mock('../../supabase', () => require('../../../test/fakeDatabase').supabaseModule);

import { useTodaysJobs } from '../jobs';
import { useNotifications } from '../notifications';
import { resetClockStyleForTests, setClockStyle } from '../../clockPref';
import { supabase } from '../../supabase';
import { installFakeDatabase } from '../../../test/fakeDatabase';

installFakeDatabase();

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return Wrapper;
}

let from: jest.SpyInstance;
beforeEach(() => {
  resetClockStyleForTests();
  from = jest.spyOn(supabase, 'from');
});
afterEach(() => from.mockRestore());

describe('useTodaysJobs', () => {
  // The cards format their own time, so the setting is a display choice only:
  // switching it keeps the cached list and downloads nothing.
  it('does not download the jobs again when the setting changes', async () => {
    const { result } = await renderHook(() => useTodaysJobs(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.length).toBeGreaterThan(0);
    const before = result.current.data;
    expect(from).toHaveBeenCalled();
    const calls = from.mock.calls.length;
    await act(async () => { setClockStyle('12h'); });
    expect(result.current.data).toBe(before);
    expect(from.mock.calls.length).toBe(calls);
  });
});

describe('useNotifications', () => {
  // Rows are worded on screen, so the setting is a display choice only:
  // switching it keeps the cached list and downloads nothing.
  it('does not download the notifications again when the setting changes', async () => {
    const { result } = await renderHook(() => useNotifications(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.length).toBeGreaterThan(0);
    const before = result.current.data;
    expect(from).toHaveBeenCalled();
    const calls = from.mock.calls.length;
    await act(async () => { setClockStyle('12h'); });
    expect(result.current.data).toBe(before);
    expect(from.mock.calls.length).toBe(calls);
  });
});
