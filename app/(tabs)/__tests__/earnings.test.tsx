import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import Earnings from '../earnings';
import { useDriverEarnings, type EarningsSummary } from '../../../lib/queries/earnings';
import { useDriverProfile } from '../../../lib/queries/driverProfile';

// REGRESSION: tapping a Recent-jobs row died with
//   "Couldn't Load Job / Cannot coerce the result to a single JSON object"
//
// Root cause: /jobs/[id] resolves its param via useJobDetailByNumber, which does
// .eq('job_number', id).single(). Every other screen routes with job_number
// (lib/queries/jobs.ts maps `id: r.job.job_number` for exactly this reason), but
// Earnings pushed `row.jobId` — the real uuid. A uuid never matches a
// job_number, so PostgREST returned 0 rows and .single() threw PGRST116.
//
// The trap is that EarningsRow carries BOTH fields and both look plausible at
// the call site. This test pins which one the route gets.

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
jest.mock('../../../lib/queries/earnings', () => ({
  ...jest.requireActual('../../../lib/queries/earnings'),
  useDriverEarnings: jest.fn(),
}));
jest.mock('../../../lib/queries/driverProfile', () => ({
  useDriverProfile: jest.fn(),
}));

const JOB_UUID = '9f8e7d6c-5b4a-4321-9876-0f1e2d3c4b5a';
const JOB_NUMBER = 'DEV-J03';

const summary = (over: Partial<EarningsSummary> = {}): EarningsSummary => ({
  rows: [{
    jobId: JOB_UUID,
    jobNumber: JOB_NUMBER,
    completedAt: '2026-07-29T02:00:00Z',
    fare: 500,
    commission: 100,
    paymentStatus: 'unpaid',
    specialRatePct: null,
  }],
  commissionTotal: 100,
  fareTotal: 500,
  jobsCount: 1,
  avgCommissionPerJob: 100,
  pendingCount: 1,
  missingCommissionCount: 0,
  ...over,
});

function mockEarnings(data: EarningsSummary | undefined, extra: Record<string, unknown> = {}) {
  (useDriverEarnings as jest.Mock).mockReturnValue({
    data, isLoading: false, isError: false, error: null,
    refetch: jest.fn(), isRefetching: false, ...extra,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useDriverProfile as jest.Mock).mockReturnValue({ data: { org: { name: 'Continental' } } });
});

describe('Earnings — Recent jobs row navigation', () => {
  it('routes with the job_number, NOT the uuid', async () => {
    mockEarnings(summary());
    await render(<Earnings/>);

    fireEvent.press(screen.getByText(JOB_NUMBER));

    expect(router.push).toHaveBeenCalledWith(`/jobs/${JOB_NUMBER}`);
    // The specific failure: pushing the uuid is what produced PGRST116.
    expect(router.push).not.toHaveBeenCalledWith(`/jobs/${JOB_UUID}`);
  });

  it('never puts a uuid in the route', async () => {
    mockEarnings(summary());
    await render(<Earnings/>);

    fireEvent.press(screen.getByText(JOB_NUMBER));

    const pushed = String((router.push as jest.Mock).mock.calls[0][0]);
    expect(pushed).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe('Earnings — row rendering', () => {
  it('shows the commission pill only on a non-standard rate', async () => {
    mockEarnings(summary({
      rows: [
        { ...summary().rows[0], jobId: 'u1', jobNumber: 'DEV-J01', specialRatePct: 20 },
        { ...summary().rows[0], jobId: 'u2', jobNumber: 'DEV-J02', specialRatePct: null },
      ],
    }));
    await render(<Earnings/>);

    // One pill for the 20% job; the standard-rate job contributes nothing.
    expect(screen.getByText('20% comm')).toBeTruthy();
    expect(screen.queryAllByText(/% comm$/)).toHaveLength(1);
  });

  it('renders an em dash when the dispatcher has not set commission', async () => {
    mockEarnings(summary({
      rows: [{ ...summary().rows[0], commission: null }],
      missingCommissionCount: 1,
    }));
    await render(<Earnings/>);

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText(/awaiting commission/)).toBeTruthy();
  });

  it('shows the empty state when there are no completed jobs', async () => {
    mockEarnings(summary({ rows: [], jobsCount: 0 }));
    await render(<Earnings/>);

    expect(screen.getByText(/No completed jobs/)).toBeTruthy();
  });

  it('surfaces a query error with a retry affordance', async () => {
    mockEarnings(undefined, { isError: true, error: new Error('boom') });
    await render(<Earnings/>);

    expect(screen.getByText("Couldn't load earnings")).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });
});
