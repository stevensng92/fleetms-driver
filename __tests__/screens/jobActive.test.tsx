import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { resetClockStyleForTests, setClockStyle } from '../../lib/clockPref';
import ActiveJob from '../../app/jobs/active';
import { useJobDetailByNumber } from '../../lib/queries/jobDetail';
import { useCompleteJob } from '../../lib/mutations/jobActions';
import { formatClock } from '../../lib/timeFormat';
import { job, stop, PICKUP_AT, DROPOFF_AT } from '../../test/jobFixtures';

// Screen tests live here, not under app/ (see earnings.test.tsx for why).
// RNTL v14: `render` and `fireEvent` are async, and every interaction is
// followed by a waitFor (TESTING.md).

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'JOB-137' }),
}));
// The query and mutation modules build a Supabase client at import, so the
// screen gets stand-ins. Nothing else from them is used by the screen.
jest.mock('../../lib/queries/jobDetail', () => ({ useJobDetailByNumber: jest.fn() }));
jest.mock('../../lib/mutations/jobActions', () => ({ useCompleteJob: jest.fn() }));

const mutateAsync = jest.fn();

function mockJob(data: unknown, extra: Record<string, unknown> = {}) {
  (useJobDetailByNumber as jest.Mock).mockReturnValue({
    data, isLoading: false, isError: false, error: null, refetch: jest.fn(), ...extra,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mutateAsync.mockReset().mockResolvedValue(undefined);
  (useCompleteJob as jest.Mock).mockReturnValue({ mutateAsync, isPending: false });
  mockJob(job());
});

describe('Active job: the trip card (change 13)', () => {
  it('has no frozen "Stop 1 of N" bar', async () => {
    await render(<ActiveJob/>);
    expect(screen.queryByText(/Stop \d+ of \d+/)).toBeNull();
  });

  it('shows the time window and the route instead', async () => {
    await render(<ActiveJob/>);
    // The window is one Text with the end time nested in it, so both match.
    expect(screen.getAllByText(new RegExp(formatClock(PICKUP_AT))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(`to ${formatClock(DROPOFF_AT)}`)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('KLIA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pavilion KL').length).toBeGreaterThan(0);
  });
});

describe('Active job: the route (changes 16 and 17)', () => {
  it('counts the stops beside the Route heading', async () => {
    await render(<ActiveJob/>);
    expect(screen.getByText('Route')).toBeTruthy();
    expect(screen.getByText('3 stops')).toBeTruthy();
  });

  it('says "1 stop" for a one-stop route', async () => {
    mockJob(job({ stops: [stop({ scheduledAt: PICKUP_AT })] }));
    await render(<ActiveJob/>);
    expect(screen.getByText('1 stop')).toBeTruthy();
  });

  it('names the stops Pickup, Stop 1 and Drop-off, and draws no time line for a stop without one', async () => {
    await render(<ActiveJob/>);
    expect(screen.getByText('Pickup')).toBeTruthy();
    expect(screen.getByText('Stop 1')).toBeTruthy();
    expect(screen.getByText('Drop-off')).toBeTruthy();
    expect(screen.queryByText('Dropoff')).toBeNull();
    expect(screen.queryByText(/—/)).toBeNull();
  });
});

describe('Active job: Mark as done asks first (change 12)', () => {
  it('opens the confirm dialog and sends nothing yet', async () => {
    await render(<ActiveJob/>);
    await fireEvent.press(screen.getByText('Mark as done'));
    expect(await screen.findByText('Mark JOB-137 done?')).toBeTruthy();
    expect(screen.getByText('Do this once the last passenger is dropped off. Dispatch is told at once.')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('Keep job open closes the dialog and still sends nothing', async () => {
    await render(<ActiveJob/>);
    await fireEvent.press(screen.getByText('Mark as done'));
    await fireEvent.press(await screen.findByText('Keep job open'));
    await waitFor(() => expect(screen.queryByText('Mark JOB-137 done?')).toBeNull());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('Mark done sends the job', async () => {
    await render(<ActiveJob/>);
    await fireEvent.press(screen.getByText('Mark as done'));
    await fireEvent.press(await screen.findByText('Mark done'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(job().jobUuid));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });
});

describe('Active job: Report an issue (change 18)', () => {
  it('stays on the screen and does nothing when pressed', async () => {
    await render(<ActiveJob/>);
    await fireEvent.press(screen.getByText('Report an issue'));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByText('Mark JOB-137 done?')).toBeNull();
  });
});

describe('Active job: not found and failed (change 20)', () => {
  it('says the job is no longer on the list when it is not found', async () => {
    mockJob(null);
    await render(<ActiveJob/>);
    expect(screen.getByText('This job is no longer on your list')).toBeTruthy();
    expect(screen.getByText('Dispatch may have cancelled or reassigned it.')).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();
    await fireEvent.press(screen.getByText('Back to jobs'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'));
  });

  it('still shows the error and Retry when the load failed', async () => {
    const refetch = jest.fn();
    mockJob(undefined, { isError: true, error: new Error('Network request failed'), refetch });
    await render(<ActiveJob/>);
    expect(screen.getByText('Network request failed')).toBeTruthy();
    expect(screen.queryByText('This job is no longer on your list')).toBeNull();
    await fireEvent.press(screen.getByText('Retry'));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it('shows a spinner, not the message, while loading', async () => {
    mockJob(undefined, { isLoading: true });
    await render(<ActiveJob/>);
    expect(screen.queryByText('This job is no longer on your list')).toBeNull();
    expect(screen.queryByText('Retry')).toBeNull();
  });
});

// Change 33: every clock follows the Time format setting.
describe('ActiveJob with the Time format setting', () => {
  afterEach(() => resetClockStyleForTests());
  it('shows the pickup time in the chosen style', async () => {
    mockJob(job({ stops: [stop({ scheduledAt: PICKUP_AT })] }));
    await render(<ActiveJob/>);
    expect(screen.getAllByText(formatClock(PICKUP_AT, '24h')).length).toBeGreaterThan(0);
    await act(async () => { setClockStyle('12h'); });
    expect(screen.getAllByText('9:15 am').length).toBeGreaterThan(0);
    expect(screen.queryByText('09:15')).toBeNull();
  });
});
