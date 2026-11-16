// Live updates: whenever a driver is signed in, a change to their assignments
// or their jobs refreshes every screen that shows a job, and coming back to
// the front catches up on anything missed while the phone slept.
import React from 'react';
import { AppState } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Handler = () => void;
const mockHandlers: Record<string, Handler> = {};
const mockFilters: Record<string, string | undefined> = {};
const mockRemoveChannel = jest.fn();
const mockChannelNames: string[] = [];
let mockDriver: { id: string } | null = { id: 'drv-1' };

jest.mock('../../supabase', () => {
  const channel = (name: string) => {
    mockChannelNames.push(name);
    const ch: any = {
      on: (_kind: string, opts: { table: string; filter?: string }, cb: Handler) => {
        mockHandlers[opts.table] = cb;
        mockFilters[opts.table] = opts.filter;
        return ch;
      },
      subscribe: () => ch,
    };
    return ch;
  };
  return {
    supabase: {
      from: () => ({ select: () => ({ maybeSingle: async () => ({ data: mockDriver, error: null }) }) }),
      channel,
      getChannels: () => [],
      removeChannel: (...a: unknown[]) => mockRemoveChannel(...a),
    },
  };
});

import { useLiveUpdates } from '../jobsRealtime';

const JOB_KEYS = [['jobs', 'today', '24h'], ['job-by-number', 'JOB-001'], ['driver-earnings', 'this-month']];

function setup(signedIn: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  for (const k of [...JOB_KEYS, ['notifications', '24h']]) qc.setQueryData(k, 'x');
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper, signedIn };
}
const stale = (qc: QueryClient, k: unknown[]) => qc.getQueryState(k)?.isInvalidated;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

let appStateCb: ((s: string) => void) | null;
const appStateRemove = jest.fn();

beforeEach(() => {
  for (const k of Object.keys(mockHandlers)) delete mockHandlers[k];
  mockChannelNames.length = 0;
  mockRemoveChannel.mockClear();
  appStateRemove.mockClear();
  mockDriver = { id: 'drv-1' };
  appStateCb = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, cb: (s: string) => void) => {
    appStateCb = cb;
    return { remove: appStateRemove };
  }) as any);
});
afterEach(() => jest.restoreAllMocks());

describe('useLiveUpdates', () => {
  it('listens to the driver\'s assignments, their jobs and their notifications once signed in', async () => {
    const { wrapper } = setup(true);
    await renderHook(() => useLiveUpdates(true), { wrapper });
    await flush();
    expect(mockChannelNames).toEqual(['driver-jobs-drv-1']);
    expect(mockFilters.assignments).toBe('driver_id=eq.drv-1');
    expect(mockHandlers.jobs).toBeDefined();
    expect(mockFilters.push_log).toBe('driver_id=eq.drv-1');
  });

  it.each(['assignments', 'jobs'])('a change to %s refreshes every screen that shows a job', async table => {
    const { qc, wrapper } = setup(true);
    await renderHook(() => useLiveUpdates(true), { wrapper });
    await flush();
    await act(async () => { mockHandlers[table](); });
    for (const k of JOB_KEYS) expect(stale(qc, k)).toBe(true);
    expect(stale(qc, ['notifications', '24h'])).toBe(false);
  });

  it('a new notification refreshes Notifications only', async () => {
    const { qc, wrapper } = setup(true);
    await renderHook(() => useLiveUpdates(true), { wrapper });
    await flush();
    await act(async () => { mockHandlers.push_log(); });
    expect(stale(qc, ['notifications', '24h'])).toBe(true);
    for (const k of JOB_KEYS) expect(stale(qc, k)).toBe(false);
  });

  it('coming back to the front catches up on every screen that shows a job', async () => {
    const { qc, wrapper } = setup(true);
    await renderHook(() => useLiveUpdates(true), { wrapper });
    await flush();
    await act(async () => { appStateCb!('background'); });
    for (const k of JOB_KEYS) expect(stale(qc, k)).toBe(false);
    await act(async () => { appStateCb!('active'); });
    for (const k of JOB_KEYS) expect(stale(qc, k)).toBe(true);
  });

  it('listens to nothing while signed out', async () => {
    const { wrapper } = setup(false);
    await renderHook(() => useLiveUpdates(false), { wrapper });
    await flush();
    expect(mockChannelNames).toEqual([]);
    expect(appStateCb).toBeNull();
  });

  it('stops listening on sign-out', async () => {
    const { wrapper } = setup(true);
    const { rerender } = await renderHook(({ s }: { s: boolean }) => useLiveUpdates(s), { wrapper, initialProps: { s: true } });
    await flush();
    await rerender({ s: false });
    await flush();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(appStateRemove).toHaveBeenCalledTimes(1);
  });

  it('looks the driver up again on each sign-in, so a new driver gets their own channel', async () => {
    const { wrapper } = setup(true);
    const { rerender } = await renderHook(({ s }: { s: boolean }) => useLiveUpdates(s), { wrapper, initialProps: { s: true } });
    await flush();
    await rerender({ s: false });
    mockDriver = { id: 'drv-2' };
    await rerender({ s: true });
    await flush();
    expect(mockChannelNames).toEqual(['driver-jobs-drv-1', 'driver-jobs-drv-2']);
  });

  it('subscribes to nothing when the signed-in account has no driver row', async () => {
    mockDriver = null;
    const { wrapper } = setup(true);
    await renderHook(() => useLiveUpdates(true), { wrapper });
    await flush();
    expect(mockChannelNames).toEqual([]);
  });
});
