import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Reanimated from 'react-native-reanimated';
import JobsToday from '../../app/(tabs)/index';
import { useTodaysJobs } from '../../lib/queries/jobs';
import { useConfirmAssignment, useRejectAssignment } from '../../lib/mutations/jobActions';
import { resetFinishedSeen, setFinishedSeen } from '../../lib/jobGroups';
import type { Job } from '../../components/JobCard';
import { myStartOfDay } from '../../lib/timeFormat';

// Screen test for the Jobs tab. Queries and mutations are mocked, so no
// Supabase client is built (see earnings.test.tsx for the same approach).

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock('../../lib/queries/jobs', () => ({ useTodaysJobs: jest.fn() }));
jest.mock('../../lib/mutations/jobActions', () => ({
  useConfirmAssignment: jest.fn(),
  useRejectAssignment: jest.fn(),
}));
jest.mock('../../lib/queries/notifications', () => ({ useUnreadCount: () => 0 }));
jest.mock('../../lib/queries/driverProfile', () => ({ useDriverProfile: () => ({ data: { name: 'Aiman Razak' } }) }));
jest.mock('../../lib/queries/appVersionConfig', () => ({ useAppVersionGate: () => ({ status: 'ok' }) }));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...actual, withSequence: jest.fn(actual.withSequence) };
});
const R = Reanimated as unknown as { withSequence: jest.Mock };

// Pickup times from the real clock (TESTING.md: never freeze Date to pin a day):
// `days` Malaysian days from today, at hh:mm Malaysian time.
const at = (days: number, hh: number, mm: number) =>
  new Date(myStartOfDay(new Date(), days).getTime() + (hh * 60 + mm) * 60_000).toISOString();

const job = (id: string, status: string, at: string, over: Partial<Job> = {}): Job => ({
  id, assignmentId: `asg-${id}`, jobUuid: `uuid-${id}`, pickupAt: at,
  vehicle: 'WXY 1234', from: 'KLIA', to: 'Bukit Bintang', client: `Client ${id}`, pax: 2, status, ...over,
});

// The download is one flat list; the screen splits it by day itself.
function mockJobs(jobs: Job[]) {
  (useTodaysJobs as jest.Mock).mockReturnValue({
    data: jobs,
    isLoading: false, isError: false, error: null, refetch: jest.fn(), isRefetching: false,
  });
}

// Fake timers for the 120ms fades, so they never race the machine's speed.
const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });
const fakeTimers = () => {
  beforeEach(() => { jest.useFakeTimers({ doNotFake: ['Date', 'performance'] }); });
  afterEach(() => { jest.useRealTimers(); });
};

const confirm = jest.fn();
const reject = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  resetFinishedSeen();
  confirm.mockResolvedValue(undefined);
  reject.mockResolvedValue(undefined);
  (useConfirmAssignment as jest.Mock).mockReturnValue({ mutateAsync: confirm });
  (useRejectAssignment as jest.Mock).mockReturnValue({ mutateAsync: reject });
});

const PENDING = job('JOB-1', 'pending', at(0, 14, 30));
const UNDER_WAY = job('JOB-2', 'in_progress', at(0, 9, 15));
const DONE = job('JOB-3', 'done', at(0, 8, 0));
const CANCELLED = job('JOB-4', 'cancelled', at(0, 17, 0));

describe('Today heading (change 10)', () => {
  it('counts the jobs still to do and shows no money', async () => {
    mockJobs([PENDING, UNDER_WAY, DONE]);
    await render(<JobsToday/>);
    expect(screen.getByText('2 jobs to go')).toBeTruthy();
    expect(screen.queryByText(/RM/)).toBeNull();
  });
  it('says All done when only finished jobs are left', async () => {
    mockJobs([DONE]);
    await render(<JobsToday/>);
    expect(screen.getByText('All done')).toBeTruthy();
  });
});

describe('Empty state (change 15)', () => {
  it('shows "No jobs scheduled today" only when nothing is coming at all', async () => {
    mockJobs([]);
    await render(<JobsToday/>);
    expect(screen.getByText('No jobs scheduled today')).toBeTruthy();
  });
  it('does not show it when only an upcoming day has a job', async () => {
    mockJobs([job('JOB-9', 'confirmed', at(3, 10, 0))]);
    await render(<JobsToday/>);
    expect(screen.queryByText('No jobs scheduled today')).toBeNull();
    expect(screen.getByText('Client JOB-9')).toBeTruthy();
  });
  it('does not show it for a day of only finished jobs', async () => {
    mockJobs([DONE]);
    await render(<JobsToday/>);
    expect(screen.queryByText('No jobs scheduled today')).toBeNull();
  });
});

describe('Today order (change 32)', () => {
  it('leads with the job under way, then the jobs still to do', async () => {
    mockJobs([PENDING, UNDER_WAY]);
    await render(<JobsToday/>);
    const clients = screen.getAllByText(/^Client JOB-/).map((n) => n.props.children);
    expect(clients).toEqual(['Client JOB-2', 'Client JOB-1']);
  });
});

describe('Finished today fold (changes 32, 36)', () => {
  fakeTimers();
  it('starts closed, with the count showing', async () => {
    mockJobs([PENDING, DONE, CANCELLED]);
    await render(<JobsToday/>);
    expect(screen.getByText('Finished today')).toBeTruthy();
    expect(screen.getByText('2 jobs')).toBeTruthy();
    expect(screen.queryByText('Client JOB-3')).toBeNull();
    expect(screen.queryByText('Client JOB-4')).toBeNull();
  });
  it('opens on tap and shows the jobs, a cancelled one as Cancelled', async () => {
    mockJobs([PENDING, DONE, CANCELLED]);
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Finished today'));
    expect(screen.getByText('Client JOB-3')).toBeTruthy();
    expect(screen.getByText('Client JOB-4')).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
  });
  it('closes again on a second tap', async () => {
    mockJobs([DONE]);
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Finished today'));
    expect(screen.getByText('Client JOB-3')).toBeTruthy();
    await fireEvent.press(screen.getByText('Finished today'));
    await advance(120);
    expect(screen.queryByText('Client JOB-3')).toBeNull();
  });
  it('is not drawn when nothing finished today', async () => {
    mockJobs([PENDING]);
    await render(<JobsToday/>);
    expect(screen.queryByText('Finished today')).toBeNull();
  });
  it('does not bump the count on first draw', async () => {
    mockJobs([DONE]);
    await render(<JobsToday/>);
    expect(R.withSequence).not.toHaveBeenCalled();
  });
  it('bumps once when a job is marked done while the screen is showing', async () => {
    mockJobs([PENDING, DONE]);
    const view = await render(<JobsToday/>);
    expect(R.withSequence).not.toHaveBeenCalled();
    mockJobs([DONE, { ...PENDING, status: 'done' }]);
    await view.rerender(<JobsToday/>);
    expect(R.withSequence).toHaveBeenCalledTimes(1);
    expect(screen.getByText('2 jobs')).toBeTruthy();
    await view.rerender(<JobsToday/>); // nothing changed: no second bump
    expect(R.withSequence).toHaveBeenCalledTimes(1);
  });
  it('bumps when the driver comes back after marking a job done on the trip screen', async () => {
    setFinishedSeen(1); // seen with one finished job before leaving for the trip screen
    mockJobs([DONE, { ...UNDER_WAY, status: 'done' }]);
    await render(<JobsToday/>);
    expect(R.withSequence).toHaveBeenCalledTimes(1);
  });
  it('does not bump when the count fell or held', async () => {
    setFinishedSeen(2);
    mockJobs([DONE]);
    await render(<JobsToday/>);
    expect(R.withSequence).not.toHaveBeenCalled();
  });
});

describe('Statuses on the Jobs list (lib/jobStatus.ts)', () => {
  fakeTimers();
  it('a rejected job sits in the Finished today fold and reads Rejected', async () => {
    mockJobs([PENDING, job('JOB-5', 'rejected', at(0, 18, 0))]);
    await render(<JobsToday/>);
    expect(screen.queryByText('Client JOB-5')).toBeNull();
    await fireEvent.press(screen.getByText('Finished today'));
    expect(screen.getByText('Rejected')).toBeTruthy();
  });
  it("an unknown status stays among the open jobs, shows the dispatcher's word and offers no Accept", async () => {
    mockJobs([job('JOB-6', 'on_hold', at(0, 18, 0))]);
    await render(<JobsToday/>);
    expect(screen.getByText('Client JOB-6')).toBeTruthy();
    expect(screen.getByText('On hold')).toBeTruthy();
    expect(screen.getByText('1 job to go')).toBeTruthy();
    expect(screen.queryByText('Accept')).toBeNull();
    expect(screen.queryByText('Finished today')).toBeNull();
  });
});

describe('Opening a job (change 14)', () => {
  it('opens an in-progress job on the trip screen from Today', async () => {
    mockJobs([UNDER_WAY]);
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Client JOB-2'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/jobs/active', params: { id: 'JOB-2' } });
  });
  it('opens an in-progress job on the trip screen from Upcoming too', async () => {
    mockJobs([job('JOB-9', 'in_progress', at(3, 10, 0))]);
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Client JOB-9'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/jobs/active', params: { id: 'JOB-9' } });
  });
  it('opens any other job on the job screen', async () => {
    mockJobs([PENDING]);
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Client JOB-1'));
    expect(router.push).toHaveBeenCalledWith('/jobs/JOB-1');
  });
});

describe('Reject from the list (change 11)', () => {
  it('opens a dialog and sends nothing until it is confirmed', async () => {
    mockJobs([PENDING]);
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Reject'));
    expect(screen.getByText('Reject JOB-1?')).toBeTruthy();
    expect(screen.getByText('Dispatch will give it to another driver.')).toBeTruthy();
    expect(reject).not.toHaveBeenCalled();
  });
  it('Keep job closes the dialog and sends nothing', async () => {
    mockJobs([PENDING]);
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Reject'));
    await fireEvent.press(screen.getByText('Keep job'));
    await waitFor(() => expect(screen.queryByText('Reject JOB-1?')).toBeNull());
    expect(reject).not.toHaveBeenCalled();
  });
  it('sends the reason through when confirmed', async () => {
    mockJobs([PENDING]);
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Reject'));
    await fireEvent.changeText(screen.getByPlaceholderText('Dispatch will see this.'), 'Car in the workshop');
    await fireEvent.press(screen.getByText('Reject job'));
    await waitFor(() => expect(reject).toHaveBeenCalledTimes(1));
    expect(reject).toHaveBeenCalledWith({ assignmentId: 'asg-JOB-1', reason: 'Car in the workshop' });
  });
  it('sends no reason when the box is left empty', async () => {
    mockJobs([PENDING]);
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Reject'));
    await fireEvent.press(screen.getByText('Reject job'));
    await waitFor(() => expect(reject).toHaveBeenCalledTimes(1));
    expect(reject).toHaveBeenCalledWith({ assignmentId: 'asg-JOB-1', reason: undefined });
  });
});

describe('Accept from the list (change 35)', () => {
  fakeTimers();
  it('accepts once after the fade', async () => {
    mockJobs([PENDING]);
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Accept'));
    await advance(119);
    expect(confirm).not.toHaveBeenCalled();
    await advance(1);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith('asg-JOB-1');
  });
});

// The day split is drawn against a "now" the screen holds, which moves at the
// next Malaysian midnight. Date stays real (TESTING.md); only the timer is fake.
describe('Midnight redraw', () => {
  fakeTimers();
  it('moves a job from Tomorrow to Today at Malaysian midnight without a download', async () => {
    mockJobs([job('JOB-7', 'confirmed', at(1, 10, 0))]);
    await render(<JobsToday/>);
    expect(screen.getByText('Tomorrow')).toBeTruthy();
    expect(screen.queryByText('1 job to go')).toBeNull();

    const toMidnight = myStartOfDay(new Date(), 1).getTime() - Date.now();
    await advance(toMidnight - 1000);
    expect(screen.getByText('Tomorrow')).toBeTruthy();

    await advance(2000);
    expect(screen.queryByText('Tomorrow')).toBeNull();
    expect(screen.getByText('1 job to go')).toBeTruthy();
    expect(screen.getByText('Client JOB-7')).toBeTruthy();
    const { refetch } = (useTodaysJobs as jest.Mock).mock.results[0].value;
    expect(refetch).not.toHaveBeenCalled();
  });
});

// Value: protects=Jobs tab failed load shows the shared error box and Retry refetches; fails_when=LoadError wiring or onRetry is dropped; why_new=no test drove isError on this screen; seam=none; no_claim=real query errors (hook mocked)
describe('Jobs list: failed load (LoadError)', () => {
  afterEach(() => { delete (globalThis as any).__FLEETMS_DEV_SESSION__; });

  function mockFailed(refetch = jest.fn(), error: Error | null = new Error('Failed to fetch')) {
    (useTodaysJobs as jest.Mock).mockReturnValue({
      data: undefined, isLoading: false, isError: true, error, refetch, isRefetching: false,
    });
    return refetch;
  }

  it('shows the error box with the message and no empty state, and Retry reloads', async () => {
    const refetch = mockFailed();
    await render(<JobsToday/>);
    expect(screen.getByText("Couldn't load jobs")).toBeTruthy();
    expect(screen.getByText('Failed to fetch')).toBeTruthy();
    expect(screen.queryByText('No jobs scheduled today')).toBeNull();
    await fireEvent.press(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('says "Unknown error" when the failure has no message', async () => {
    mockFailed(jest.fn(), null);
    await render(<JobsToday/>);
    expect(screen.getByText('Unknown error')).toBeTruthy();
  });

  it('adds the dev auth status under the message only when the session is not ok', async () => {
    (globalThis as any).__FLEETMS_DEV_SESSION__ = { kind: 'no-creds' };
    mockFailed();
    await render(<JobsToday/>);
    expect(screen.getByText(/Auth status: no-creds/)).toBeTruthy();
  });

  it('shows no auth status line when the dev session is ok', async () => {
    (globalThis as any).__FLEETMS_DEV_SESSION__ = { kind: 'ok' };
    mockFailed();
    await render(<JobsToday/>);
    expect(screen.queryByText(/Auth status/)).toBeNull();
  });
});
