import React from 'react';
import { PanResponder } from 'react-native';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Earnings from '../../app/(tabs)/earnings';
import { useDriverEarnings, useEarningsHistoryStart, type EarningsSummary } from '../../lib/queries/earnings';
import { useDriverProfile } from '../../lib/queries/driverProfile';
import { periodKeysDesc, periodHeadline } from '../../lib/earningsPeriod';

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
  useEarningsHistoryStart: jest.fn(),
  ROW_LIMIT: 200,
}));
// NOT mocked: lib/earningsPeriod is pure (no Supabase client at import), so the
// screen can use the real monthPeriod/monthKeyOf. That is the reason the period
// helpers were moved out of the query module.
jest.mock('../../lib/queries/driverProfile', () => ({
  useDriverProfile: jest.fn(),
}));

const JOB_UUID = '9f8e7d6c-5b4a-4321-9876-0f1e2d3c4b5a';
const JOB_NUMBER = 'DEV-J03';

const summary = (over: Partial<EarningsSummary> = {}): EarningsSummary => ({
  rows: [{
    jobId: JOB_UUID,
    jobNumber: JOB_NUMBER,
    jobDate: '2026-07-29T02:00:00Z',
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

/** The driver's earliest completed job — periodCount turns this into pages. */
function mockHistoryStart(iso: string | null | undefined) {
  (useEarningsHistoryStart as jest.Mock).mockReturnValue({ data: iso });
}

// The pager names its periods against `new Date()`, so a hardcoded "July 2026"
// would rot the moment the month turned. Expectations are derived from the real
// clock through the SAME pure helpers the screen uses.
//
// Freezing the clock with fake timers was tried first and is a trap: React 19's
// concurrent scheduler starves once Date stops advancing, so the suite passed
// test-by-test under `-t` and collapsed from the sixth render onwards when run
// together. The date arithmetic itself is pinned exhaustively against a fixed
// instant in lib/__tests__/earningsPeriod.test.ts — this file's job is wiring.
const now = () => new Date();
const monthsBack = (n: number) => periodKeysDesc('month', n + 1, now())[n];
const weeksBack  = (n: number) => periodKeysDesc('week',  n + 1, now())[n];
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  jest.clearAllMocks();
  (useDriverProfile as jest.Mock).mockReturnValue({ data: { org: { name: 'Continental' } } });
  mockHistoryStart(new Date(Date.now() - 150 * DAY).toISOString()); // ~5 months
  // Every test gets a working baseline and overrides what it cares about.
  // Without this the suite is order-dependent: clearAllMocks wipes call
  // records but NOT return values, so a test that skipped mockEarnings only
  // passed by inheriting the previous test's, and failed the moment it ran
  // alone under `-t`.
  mockEarnings(summary());
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

    expect(screen.getByText('20% of the fare')).toBeTruthy();
    expect(screen.queryAllByText(/% of the fare$/)).toHaveLength(1);
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
    expect(screen.queryAllByText(/% of the fare$/)).toHaveLength(0);
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

  it('keeps the cents in fares, the average and the rows (change 21)', async () => {
    mockEarnings(summary({
      fareTotal: 1234.5, avgCommissionPerJob: 33.33, commissionTotal: 1068,
      rows: [{ ...summary().rows[0], fare: 500, commission: 100 }],
    }));
    await render(<Earnings/>);

    expect(screen.getByText('RM 1,234.50 in fares')).toBeTruthy();
    expect(screen.getByText('RM 33.33')).toBeTruthy();
    expect(screen.getByText('Average per job')).toBeTruthy();
    expect(screen.getByText('RM 500.00 fare')).toBeTruthy();
    expect(screen.getByText('RM 100.00')).toBeTruthy();
    expect(screen.getByText('RM 1,068')).toBeTruthy();
    expect(screen.getByText('.00')).toBeTruthy();
  });

  it('words each payment status, with no Invoiced and no Pending (change 22)', async () => {
    const base = summary().rows[0];
    mockEarnings(summary({
      rows: [
        { ...base, jobId: 'a', jobNumber: 'J-A', paymentStatus: 'paid' },
        { ...base, jobId: 'b', jobNumber: 'J-B', paymentStatus: 'unpaid' },
        { ...base, jobId: 'c', jobNumber: 'J-C', paymentStatus: 'waived' },
        { ...base, jobId: 'd', jobNumber: 'J-D', paymentStatus: 'refunded' },
      ],
      pendingCount: 3,
    }));
    await render(<Earnings/>);

    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getByText('Waived')).toBeTruthy();
    expect(screen.getByText('Refunded')).toBeTruthy();
    // One on the row, one as the figure's label.
    expect(screen.getAllByText('Unpaid')).toHaveLength(2);
    expect(screen.queryByText('Pending')).toBeNull();
    expect(screen.queryByText('Invoiced')).toBeNull();
    expect(screen.getByText('3 jobs')).toBeTruthy();
  });

  it('shows None when nothing is unpaid', async () => {
    mockEarnings(summary({ pendingCount: 0 }));
    await render(<Earnings/>);
    expect(screen.getByText('None')).toBeTruthy();
  });

  it('has no page dots (change 23)', async () => {
    await render(<Earnings/>);
    expect(screen.queryByTestId('page-dot')).toBeNull();
  });

  it('says "Awaiting commission" on a row the dispatcher has not priced (change 23)', async () => {
    mockEarnings(summary({
      rows: [{ ...summary().rows[0], commission: null }],
      missingCommissionCount: 1,
    }));
    await render(<Earnings/>);

    expect(screen.getByText('Awaiting commission')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.getByText(/awaiting commission from dispatcher/)).toBeTruthy();
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

  // Value: protects=Earnings Retry button refetches; fails_when=onRetry is not wired to refetch in LoadError use; why_new=the test above only checks Retry exists; seam=none; no_claim=real query errors (hook mocked)
  it('Retry reloads earnings', async () => {
    const refetch = jest.fn();
    mockEarnings(undefined, { isError: true, error: new Error('boom'), refetch });
    await render(<Earnings/>);
    await fireEvent.press(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('Earnings — period pager', () => {
  // The feature drivers asked for: look back at finished periods. v0.8.0 put a
  // chip per month in a scrolling strip and the first person to use it
  // concluded the app only went back one month — the months were off-screen
  // with the scroll indicator disabled. The period axis now lives on the card.

  it('offers the three modes as fixed tabs, with no period chips', async () => {
    await render(<Earnings/>);

    expect(screen.getByText('Week')).toBeTruthy();
    expect(screen.getByText('Month')).toBeTruthy();
    expect(screen.getByText('All time')).toBeTruthy(); // the tab; the card only says it once All is picked
    // The old strip put period names in the selector. They belong on the card.
    expect(screen.queryByText('This Month')).toBeNull();
  });

  it('starts on the current month and names it relatively', async () => {
    await render(<Earnings/>);
    expect(screen.getByText('This month')).toBeTruthy();
  });

  it('advertises the swipe, naming the direction', async () => {
    await render(<Earnings/>);
    expect(screen.getByText('Swipe right for earlier months')).toBeTruthy();
    fireEvent.press(screen.getByText('Week'));
    expect(await screen.findByText('Swipe right for earlier weeks')).toBeTruthy();
  });

  it('pages back a month and re-queries for it', async () => {
    await render(<Earnings/>);

    fireEvent.press(screen.getByLabelText('Show an earlier period'));

    expect(await screen.findByText(periodHeadline(monthsBack(1), now()))).toBeTruthy();
    // Re-queried, not filtered in the screen — a client-side filter over a
    // this-month result set would leave every past period empty.
    await waitFor(() => expect(useDriverEarnings).toHaveBeenLastCalledWith(monthsBack(1)));
  });

  it('stops at the ceiling of three periods', async () => {
    // MAX_PERIODS is 3. A fourth press must not walk off the end into a period
    // the pager never generated — periodRange throws on an unknown key.
    await render(<Earnings/>);
    const earlier = screen.getByLabelText('Show an earlier period');

    // Awaited one at a time. Firing four presses back-to-back leaves React 19
    // work queued that never flushes before the test ends, and the unsettled
    // root then breaks EVERY subsequent render in the file — the failure shows
    // up as "unable to find element" in later tests, nowhere near the cause.
    for (let i = 0; i < 4; i++) {
      fireEvent.press(earlier);
      await waitFor(() => expect(useDriverEarnings).toHaveBeenCalled());
    }

    expect(await screen.findByText(periodHeadline(monthsBack(2), now()))).toBeTruthy();
    await waitFor(() => expect(useDriverEarnings).toHaveBeenLastCalledWith(monthsBack(2)));
  });

  it('never offers more periods than the driver has history for', async () => {
    // Bounded by real history, never padded to the ceiling: a page the driver
    // cannot have worked is a dot promising data and delivering an empty state.
    mockHistoryStart(new Date().toISOString()); // first job was today
    await render(<Earnings/>);

    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.queryByLabelText('Show an earlier period')).toBeNull();
    expect(screen.queryByText(/Swipe right for earlier/)).toBeNull();
  });

  it('switches to calendar weeks and resets to the current one', async () => {
    await render(<Earnings/>);
    fireEvent.press(screen.getByLabelText('Show an earlier period'));
    await screen.findByText(periodHeadline(monthsBack(1), now()));

    fireEvent.press(screen.getByText('Week'));

    // Back to offset 0 in the new mode — carrying the offset across would land
    // on a week chosen by how far back you had paged the months.
    expect(await screen.findByText('This week')).toBeTruthy();
    await waitFor(() => expect(useDriverEarnings).toHaveBeenLastCalledWith(weeksBack(0)));
  });

  it('names last week relatively and earlier weeks by their dates', async () => {
    await render(<Earnings/>);
    fireEvent.press(screen.getByText('Week'));
    await screen.findByText('This week');

    fireEvent.press(screen.getByLabelText('Show an earlier period'));
    expect(await screen.findByText('Last week')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Show an earlier period'));
    // Two weeks back is named by its dates, not "2 weeks ago" — that would put
    // the arithmetic on the person least able to check it.
    const label = periodHeadline(weeksBack(2), now());
    expect(label).toMatch(/^\d{1,2} \w{3} to \d{1,2} \w{3}/);
    expect(await screen.findByText(label)).toBeTruthy();
  });

  it('drops the pager entirely on All Time', async () => {
    await render(<Earnings/>);
    fireEvent.press(screen.getByText('All time'));

    // Twice now: the tab and the card heading both read "All time".
    await waitFor(() => expect(screen.getAllByText('All time')).toHaveLength(2));
    expect(screen.queryByLabelText('Show an earlier period')).toBeNull();
    await waitFor(() => expect(useDriverEarnings).toHaveBeenLastCalledWith('all'));
  });

  it('names the period in the empty state instead of lowercasing it', async () => {
    mockEarnings(summary({ rows: [], jobsCount: 0 }));
    await render(<Earnings/>);

    fireEvent.press(screen.getByLabelText('Show an earlier period'));

    const expected = `No completed jobs in ${periodHeadline(monthsBack(1), now())}.`;
    // Capitalised month name — the old code lowercased the headline and
    // produced "in july 2026".
    expect(expected).toMatch(/in [A-Z]/);
    expect(await screen.findByText(expected)).toBeTruthy();
  });

  it('still works when the history query has not resolved', async () => {
    // The pager is a nicety; the current period is the screen. A pending or
    // failed history read must not take Earnings down with it.
    mockHistoryStart(undefined);
    await render(<Earnings/>);

    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.getByText('Month')).toBeTruthy();
  });

  it('shows the job date on a row, which is what the period was chosen by', async () => {
    // Rows are bucketed by MY-local PICKUP date to match create_driver_payout.
    // Displaying a completion date would put an August date under a July
    // heading on every job closed late.
    mockEarnings(summary());
    await render(<Earnings/>);

    expect(screen.getByText('29 Jul')).toBeTruthy();
  });
});

describe('Earnings — page turn slide (change 37) and swipe (change 38)', () => {
  // The swipe is a PanResponder. Its release handler is called directly with a
  // gesture state: simulating touch history is not what is under test.
  type Release = (e: unknown, g: { dx: number; dy: number }) => void;
  let spy: jest.SpyInstance;
  beforeEach(() => { spy = jest.spyOn(PanResponder, 'create'); });
  afterEach(() => spy.mockRestore());
  const swipe = async (dx: number, dy = 0) => {
    const cfg = spy.mock.calls[0][0] as { onPanResponderRelease: Release };
    await act(async () => { cfg.onPanResponderRelease({}, { dx, dy }); });
  };

  it('starts still, with nothing sliding', async () => {
    await render(<Earnings/>);
    expect(screen.getAllByTestId('page-turn-still').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('page-turn-left')).toHaveLength(0);
    expect(screen.queryAllByTestId('page-turn-right')).toHaveLength(0);
  });

  it('Earlier arrow brings the page in from the left, Later from the right', async () => {
    await render(<Earnings/>);
    fireEvent.press(screen.getByLabelText('Show an earlier period'));
    await screen.findByText(periodHeadline(monthsBack(1), now()));
    // The period name, the figures and the job list.
    expect(screen.getAllByTestId('page-turn-left')).toHaveLength(3);

    fireEvent.press(screen.getByLabelText('Show a later period'));
    await screen.findByText('This month');
    expect(screen.getAllByTestId('page-turn-right')).toHaveLength(3);
    expect(screen.queryAllByTestId('page-turn-left')).toHaveLength(0);
  });

  it('a rightward swipe goes earlier and slides in from the left', async () => {
    await render(<Earnings/>);
    await swipe(60);

    expect(await screen.findByText(periodHeadline(monthsBack(1), now()))).toBeTruthy();
    expect(screen.getAllByTestId('page-turn-left')).toHaveLength(3);
  });

  it('a leftward swipe goes later and slides in from the right', async () => {
    await render(<Earnings/>);
    fireEvent.press(screen.getByLabelText('Show an earlier period'));
    await screen.findByText(periodHeadline(monthsBack(1), now()));

    await swipe(-60);
    expect(await screen.findByText('This month')).toBeTruthy();
    expect(screen.getAllByTestId('page-turn-right')).toHaveLength(3);
  });

  it('a short or mostly vertical drag does nothing', async () => {
    await render(<Earnings/>);
    await swipe(30);
    await swipe(60, 80);

    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.queryAllByTestId('page-turn-left')).toHaveLength(0);
  });

  it('a swipe with nowhere to go does nothing and does not replay the slide', async () => {
    await render(<Earnings/>);
    await swipe(-60); // already on the newest page, later has nowhere to go

    expect(screen.queryAllByTestId('page-turn-right')).toHaveLength(0);
    expect(screen.getByText('This month')).toBeTruthy();
  });

  it('Week / Month / All switches do not slide', async () => {
    await render(<Earnings/>);
    fireEvent.press(screen.getByLabelText('Show an earlier period'));
    await screen.findByText(periodHeadline(monthsBack(1), now()));

    fireEvent.press(screen.getByText('Week'));
    await screen.findByText('This week');
    expect(screen.queryAllByTestId('page-turn-left')).toHaveLength(0);
    expect(screen.queryAllByTestId('page-turn-right')).toHaveLength(0);
    expect(screen.getAllByTestId('page-turn-still').length).toBeGreaterThan(0);
  });
});
