import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import Earnings from '../../app/(tabs)/earnings';
import { useDriverEarnings, type EarningsSummary } from '../../lib/queries/earnings';
import { useDriverProfile } from '../../lib/queries/driverProfile';

// NOTE ON LOCATION: screen tests must NOT live under app/. expo-router's
// require.context regex (see node_modules/expo-router/_ctx.android.js) matches
// every .tsx under the app root and its ignore list covers only +html,
// +native-intent, +api and +middleware — nothing for __tests__ or .test.
// A test file under app/ therefore registers as a real ROUTE: it ships in the
// production bundle, drags react-test-renderer in with it, and renders as a
// stray tab that throws "jest is not defined" when tapped.
//
// REGRESSION: tapping a Recent-jobs row died with
//   "Couldn't Load Job / Cannot coerce the result to a single JSON object"
//
// Root cause: /jobs/[id] resolves its param via useJobDetailByNumber, which does
// .eq('job_number', id).single(). Every other screen routes with job_number
// (lib/queries/jobs.ts maps `id: r.job.job_number` for exactly this reason), but
// Earnings pushed `row.jobId` — the real uuid. A uuid never matches a
// job_number, so PostgREST returned 0 rows and .single() threw PGRST116.

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
// No requireActual here: the only other import from this module is a type,
// which is erased at compile time. Pulling the real module in would construct a
// live Supabase client against a placeholder URL just to run a screen test.
// ROW_LIMIT is restated rather than pulled through requireActual: the real
// module constructs a Supabase client at import time, which a screen test has
// no business doing. If the cap changes, this and the expectation below change
// together and the mismatch is visible in the diff.
jest.mock('../../lib/queries/earnings', () => ({
  useDriverEarnings: jest.fn(),
  ROW_LIMIT: 200,
}));
jest.mock('../../lib/queries/driverProfile', () => ({
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
    specialCommission: null,
  }],
  commissionTotal: 100,
  fareTotal: 500,
  jobsCount: 1,
  avgCommissionPerJob: 100,
  pendingCount: 1,
  missingCommissionCount: 0,
  truncated: false,
  totalCount: 1,
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

    // The typed-params form, not a raw interpolated string: job_number is
    // rendered from the org-editable `organizations.job_format` template, so a
    // format containing "/" or "?" would break a hand-built path. expo-router
    // encodes `params` for us.
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/jobs/[id]',
      params: { id: JOB_NUMBER },
    });
  });

  it('never puts a uuid in the route', async () => {
    mockEarnings(summary());
    await render(<Earnings/>);

    fireEvent.press(screen.getByText(JOB_NUMBER));

    const arg = (router.push as jest.Mock).mock.calls[0][0];
    const id = String(typeof arg === 'string' ? arg : arg.params.id);
    expect(id).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe('Earnings — row rendering', () => {
  it('shows the commission pill only on a non-standard rate', async () => {
    mockEarnings(summary({
      rows: [
        { ...summary().rows[0], jobId: 'u1', jobNumber: 'DEV-J01', specialCommission: { kind: 'rate', pct: 20 } },
        { ...summary().rows[0], jobId: 'u2', jobNumber: 'DEV-J02', specialCommission: null },
      ],
    }));
    await render(<Earnings/>);

    expect(screen.getByText('20% comm')).toBeTruthy();
    expect(screen.queryAllByText(/% comm$/)).toHaveLength(1);
  });

  it('labels a fixed-fee row as a flat fee, not a percentage', async () => {
    // The row shows a RM 80 take-home against a RM 500 fare. Without the pill
    // naming the mode, that reads as a shortfall against the org's ~20% cut
    // (~RM 100) rather than as the fee that was actually agreed.
    mockEarnings(summary({
      rows: [{
        ...summary().rows[0],
        commission: 80,
        specialCommission: { kind: 'fixed', amount: 80 },
      }],
    }));
    await render(<Earnings/>);

    expect(screen.getByText('RM 80 flat')).toBeTruthy();
    expect(screen.queryAllByText(/% comm$/)).toHaveLength(0);
  });

  it('says "No fare set" rather than RM 0.00 on a fareless job', async () => {
    // Newly reachable: a fixed fee resolves even with no fare (fleetms D1), so
    // a real commission can now sit beside an absent fare. Coercing that to
    // "RM 0.00 fare" reads as a bug rather than as missing data.
    mockEarnings(summary({
      rows: [{
        ...summary().rows[0],
        fare: null,
        commission: 80,
        specialCommission: { kind: 'fixed', amount: 80 },
      }],
      fareTotal: 0,
    }));
    await render(<Earnings/>);

    expect(screen.getByText('No fare set')).toBeTruthy();
    expect(screen.queryByText(/RM 0\.00 fare/)).toBeNull();
    // The take-home itself is unaffected — it comes from the dispatcher's
    // snapshot, not from any arithmetic against the missing fare.
    expect(screen.getByText('RM 80.00')).toBeTruthy();
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

  it('says so when the totals only cover the most recent 200 jobs', async () => {
    // The failure this guards is silent: past the cap the headline RM figure
    // just stops growing correctly, with no error and no visual cue, on the
    // screen a driver uses to check they were paid right.
    mockEarnings(summary({ truncated: true, totalCount: 247 }));
    await render(<Earnings/>);

    expect(screen.getByText(/Showing your 200 most recent jobs of 247/)).toBeTruthy();
  });

  it('stays quiet when nothing was truncated', async () => {
    mockEarnings(summary({ truncated: false }));
    await render(<Earnings/>);

    expect(screen.queryByText(/most recent/)).toBeNull();
  });

  it('surfaces a query error with a retry affordance', async () => {
    mockEarnings(undefined, { isError: true, error: new Error('boom') });
    await render(<Earnings/>);

    expect(screen.getByText("Couldn't load earnings")).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });
});
