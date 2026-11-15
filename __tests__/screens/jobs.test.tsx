import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Reanimated from 'react-native-reanimated';
import JobsToday from '../../app/(tabs)/index';
import { useTodaysJobs } from '../../lib/queries/jobs';
import { useConfirmAssignment, useRejectAssignment } from '../../lib/mutations/jobActions';
import { resetFinishedSeen, setFinishedSeen } from '../../lib/jobGroups';
import type { Job } from '../../components/JobCard';

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
jest.mock('../../lib/realtime/jobsRealtime', () => ({ useJobsRealtime: () => undefined }));
jest.mock('../../lib/queries/appVersionConfig', () => ({ useAppVersionGate: () => ({ status: 'ok' }) }));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...actual, withSequence: jest.fn(actual.withSequence) };
});
const R = Reanimated as unknown as { withSequence: jest.Mock };

const job = (id: string, status: Job['status'], at: string, over: Partial<Job> = {}): Job => ({
  id, assignmentId: `asg-${id}`, jobUuid: `uuid-${id}`, time: at.slice(11, 16), pickupAt: at,
  vehicle: 'WXY 1234', from: 'KLIA', to: 'Bukit Bintang', client: `Client ${id}`, pax: 2, status, ...over,
});

type Data = { overdue?: Job[]; today?: Job[]; tomorrow?: Job[]; upcoming?: { dateKey: string; label: string; jobs: Job[] }[] };
function mockJobs(d: Data) {
  (useTodaysJobs as jest.Mock).mockReturnValue({
    data: { overdue: [], today: [], tomorrow: [], upcoming: [], ...d },
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

const PENDING = job('JOB-1', 'pending', '2026-07-29T06:30:00Z');
const UNDER_WAY = job('JOB-2', 'progress', '2026-07-29T01:15:00Z');
const DONE = job('JOB-3', 'done', '2026-07-29T00:00:00Z');
const CANCELLED = job('JOB-4', 'voided', '2026-07-29T09:00:00Z', { rawStatus: 'cancelled' });

describe('Today heading (change 10)', () => {
  it('counts the jobs still to do and shows no money', async () => {
    mockJobs({ today: [PENDING, UNDER_WAY, DONE] });
    await render(<JobsToday/>);
    expect(screen.getByText('2 jobs to go')).toBeTruthy();
    expect(screen.queryByText(/RM/)).toBeNull();
  });
  it('says All done when only finished jobs are left', async () => {
    mockJobs({ today: [DONE] });
    await render(<JobsToday/>);
    expect(screen.getByText('All done')).toBeTruthy();
  });
});

describe('Empty state (change 15)', () => {
  it('shows "No jobs scheduled today" only when nothing is coming at all', async () => {
    mockJobs({});
    await render(<JobsToday/>);
    expect(screen.getByText('No jobs scheduled today')).toBeTruthy();
  });
  it('does not show it when only an upcoming day has a job', async () => {
    mockJobs({ upcoming: [{ dateKey: '2026-08-01', label: 'Sat, 1 Aug', jobs: [job('JOB-9', 'confirmed', '2026-08-01T02:00:00Z')] }] });
    await render(<JobsToday/>);
    expect(screen.queryByText('No jobs scheduled today')).toBeNull();
    expect(screen.getByText('Client JOB-9')).toBeTruthy();
  });
  it('does not show it for a day of only finished jobs', async () => {
    mockJobs({ today: [DONE] });
    await render(<JobsToday/>);
    expect(screen.queryByText('No jobs scheduled today')).toBeNull();
  });
});

describe('Today order (change 32)', () => {
  it('leads with the job under way, then the jobs still to do', async () => {
    mockJobs({ today: [PENDING, UNDER_WAY] });
    await render(<JobsToday/>);
    const clients = screen.getAllByText(/^Client JOB-/).map((n) => n.props.children);
    expect(clients).toEqual(['Client JOB-2', 'Client JOB-1']);
  });
});

describe('Finished today fold (changes 32, 36)', () => {
  fakeTimers();
  it('starts closed, with the count showing', async () => {
    mockJobs({ today: [PENDING, DONE, CANCELLED] });
    await render(<JobsToday/>);
    expect(screen.getByText('Finished today')).toBeTruthy();
    expect(screen.getByText('2 jobs')).toBeTruthy();
    expect(screen.queryByText('Client JOB-3')).toBeNull();
    expect(screen.queryByText('Client JOB-4')).toBeNull();
  });
  it('opens on tap and shows the jobs, a cancelled one as Cancelled', async () => {
    mockJobs({ today: [PENDING, DONE, CANCELLED] });
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Finished today'));
    expect(screen.getByText('Client JOB-3')).toBeTruthy();
    expect(screen.getByText('Client JOB-4')).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
  });
  it('closes again on a second tap', async () => {
    mockJobs({ today: [DONE] });
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Finished today'));
    expect(screen.getByText('Client JOB-3')).toBeTruthy();
    await fireEvent.press(screen.getByText('Finished today'));
    await advance(120);
    expect(screen.queryByText('Client JOB-3')).toBeNull();
  });
  it('is not drawn when nothing finished today', async () => {
    mockJobs({ today: [PENDING] });
    await render(<JobsToday/>);
    expect(screen.queryByText('Finished today')).toBeNull();
  });
  it('does not bump the count on first draw', async () => {
    mockJobs({ today: [DONE] });
    await render(<JobsToday/>);
    expect(R.withSequence).not.toHaveBeenCalled();
  });
  it('bumps once when a job is marked done while the screen is showing', async () => {
    mockJobs({ today: [PENDING, DONE] });
    const view = await render(<JobsToday/>);
    expect(R.withSequence).not.toHaveBeenCalled();
    mockJobs({ today: [DONE, { ...PENDING, status: 'done' }] });
    await view.rerender(<JobsToday/>);
    expect(R.withSequence).toHaveBeenCalledTimes(1);
    expect(screen.getByText('2 jobs')).toBeTruthy();
    await view.rerender(<JobsToday/>); // nothing changed: no second bump
    expect(R.withSequence).toHaveBeenCalledTimes(1);
  });
  it('bumps when the driver comes back after marking a job done on the trip screen', async () => {
    setFinishedSeen(1); // seen with one finished job before leaving for the trip screen
    mockJobs({ today: [DONE, { ...UNDER_WAY, status: 'done' }] });
    await render(<JobsToday/>);
    expect(R.withSequence).toHaveBeenCalledTimes(1);
  });
  it('does not bump when the count fell or held', async () => {
    setFinishedSeen(2);
    mockJobs({ today: [DONE] });
    await render(<JobsToday/>);
    expect(R.withSequence).not.toHaveBeenCalled();
  });
});

describe('Opening a job (change 14)', () => {
  it('opens an in-progress job on the trip screen from Today', async () => {
    mockJobs({ today: [UNDER_WAY] });
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Client JOB-2'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/jobs/active', params: { id: 'JOB-2' } });
  });
  it('opens an in-progress job on the trip screen from Upcoming too', async () => {
    mockJobs({ upcoming: [{ dateKey: '2026-08-01', label: 'Sat, 1 Aug', jobs: [job('JOB-9', 'progress', '2026-08-01T02:00:00Z')] }] });
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Client JOB-9'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/jobs/active', params: { id: 'JOB-9' } });
  });
  it('opens any other job on the job screen', async () => {
    mockJobs({ today: [PENDING] });
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Client JOB-1'));
    expect(router.push).toHaveBeenCalledWith('/jobs/JOB-1');
  });
});

describe('Reject from the list (change 11)', () => {
  it('opens a dialog and sends nothing until it is confirmed', async () => {
    mockJobs({ today: [PENDING] });
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Reject'));
    expect(screen.getByText('Reject JOB-1?')).toBeTruthy();
    expect(screen.getByText('Dispatch will give it to another driver.')).toBeTruthy();
    expect(reject).not.toHaveBeenCalled();
  });
  it('Keep job closes the dialog and sends nothing', async () => {
    mockJobs({ today: [PENDING] });
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Reject'));
    await fireEvent.press(screen.getByText('Keep job'));
    await waitFor(() => expect(screen.queryByText('Reject JOB-1?')).toBeNull());
    expect(reject).not.toHaveBeenCalled();
  });
  it('sends the reason through when confirmed', async () => {
    mockJobs({ today: [PENDING] });
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Reject'));
    await fireEvent.changeText(screen.getByPlaceholderText('Dispatch will see this.'), 'Car in the workshop');
    await fireEvent.press(screen.getByText('Reject job'));
    await waitFor(() => expect(reject).toHaveBeenCalledTimes(1));
    expect(reject).toHaveBeenCalledWith({ assignmentId: 'asg-JOB-1', reason: 'Car in the workshop' });
  });
  it('sends no reason when the box is left empty', async () => {
    mockJobs({ today: [PENDING] });
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
    mockJobs({ today: [PENDING] });
    await render(<JobsToday/>);
    await fireEvent.press(screen.getByText('Accept'));
    await advance(119);
    expect(confirm).not.toHaveBeenCalled();
    await advance(1);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith('asg-JOB-1');
  });
});
