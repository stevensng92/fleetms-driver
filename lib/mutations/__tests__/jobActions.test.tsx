// One list of what refreshes after any job change: the Jobs list, every open
// job or Trip screen, and Earnings. The four job actions and the live listener
// all use it, so no screen can be missed by one path and not the other.
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRpc = jest.fn();
jest.mock('../../supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

import {
  refreshJobs, useConfirmAssignment, useRejectAssignment, useStartJob, useCompleteJob,
} from '../jobActions';

// Every query that shows a job, seeded so the test can see which go stale.
const JOB_KEYS = [
  ['jobs', 'today', '24h'],
  ['job-by-number', 'JOB-001'],
  ['driver-earnings', 'this-month'],
  ['driver-earnings-history-start'],
];
const OTHER_KEYS = [['notifications', '24h'], ['driver-profile'], ['expenses']];

function seededClient() {
  // gcTime Infinity: no cleanup timers, so jest can exit.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  for (const k of [...JOB_KEYS, ...OTHER_KEYS]) qc.setQueryData(k, 'x');
  return qc;
}
const stale = (qc: QueryClient, k: unknown[]) => qc.getQueryState(k)?.isInvalidated;

beforeEach(() => { mockRpc.mockReset(); mockRpc.mockResolvedValue({ data: null, error: null }); });

describe('refreshJobs', () => {
  it('marks every query that shows a job stale, and nothing else', async () => {
    const qc = seededClient();
    await refreshJobs(qc);
    for (const k of JOB_KEYS) expect(stale(qc, k)).toBe(true);
    for (const k of OTHER_KEYS) expect(stale(qc, k)).toBe(false);
  });
});

describe('job actions', () => {
  const cases: [string, () => any, unknown][] = [
    ['Accept', () => useConfirmAssignment(), 'asg-1'],
    ['Reject', () => useRejectAssignment(), { assignmentId: 'asg-1', reason: 'sick' }],
    ['Start', () => useStartJob(), 'job-uuid-1'],
    ['Complete', () => useCompleteJob(), 'job-uuid-1'],
  ];

  it.each(cases)('%s refreshes every screen that shows the job', async (_name, hook, arg) => {
    const qc = seededClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = await renderHook(hook, { wrapper });
    await act(async () => { await result.current.mutateAsync(arg); });
    for (const k of JOB_KEYS) expect(stale(qc, k)).toBe(true);
    for (const k of OTHER_KEYS) expect(stale(qc, k)).toBe(false);
  });

  it('refreshes nothing when the server refuses the action', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'no' } });
    const qc = seededClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = await renderHook(() => useStartJob(), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync('job-uuid-1')).rejects.toBeTruthy(); });
    for (const k of JOB_KEYS) expect(stale(qc, k)).toBe(false);
  });
});
