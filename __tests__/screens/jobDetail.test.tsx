import React from 'react';
import { Alert } from 'react-native';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { resetClockStyleForTests, setClockStyle } from '../../lib/clockPref';
import JobDetail from '../../app/jobs/[id]';
import { useJobDetailByNumber } from '../../lib/queries/jobDetail';
import { useStartJob, useConfirmAssignment, useRejectAssignment } from '../../lib/mutations/jobActions';
import { job, stop, PICKUP_AT } from '../../test/jobFixtures';

// Screen tests live here, not under app/ (see earnings.test.tsx for why).
// RNTL v14: `render` and `fireEvent` are async.

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'JOB-137' }),
}));
jest.mock('../../lib/queries/jobDetail', () => ({ useJobDetailByNumber: jest.fn() }));
jest.mock('../../lib/mutations/jobActions', () => ({
  useStartJob: jest.fn(),
  useConfirmAssignment: jest.fn(),
  useRejectAssignment: jest.fn(),
}));

const idle = { mutateAsync: jest.fn(), isPending: false };

function mockJob(data: unknown, extra: Record<string, unknown> = {}) {
  (useJobDetailByNumber as jest.Mock).mockReturnValue({
    data, isLoading: false, isError: false, error: null, refetch: jest.fn(), ...extra,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useStartJob as jest.Mock).mockReturnValue(idle);
  (useConfirmAssignment as jest.Mock).mockReturnValue(idle);
  (useRejectAssignment as jest.Mock).mockReturnValue(idle);
  mockJob(job({ status: 'confirmed' }));
});

describe('Job detail: the route (changes 16 and 17)', () => {
  it('counts the stops beside the Route heading', async () => {
    await render(<JobDetail/>);
    expect(screen.getByText('Route')).toBeTruthy();
    expect(screen.getByText('3 stops')).toBeTruthy();
  });

  it('says "1 stop", not "1 stops"', async () => {
    mockJob(job({ status: 'confirmed', stops: [stop({ scheduledAt: PICKUP_AT })] }));
    await render(<JobDetail/>);
    expect(screen.getByText('1 stop')).toBeTruthy();
    expect(screen.queryByText('1 stops')).toBeNull();
  });

  it('names the stops Pickup, Stop 1 and Drop-off, and draws no "—: —" for a stop without a time', async () => {
    await render(<JobDetail/>);
    expect(screen.getByText('Pickup')).toBeTruthy();
    expect(screen.getByText('Stop 1')).toBeTruthy();
    expect(screen.getByText('Drop-off')).toBeTruthy();
    expect(screen.queryByText('Dropoff')).toBeNull();
    expect(screen.queryByText(/—/)).toBeNull();
  });
});

describe('Job detail: Report an issue (change 18)', () => {
  it('is restyled but still does nothing', async () => {
    await render(<JobDetail/>);
    await fireEvent.press(screen.getByText('Report an issue'));
    expect(router.push).not.toHaveBeenCalled();
    expect(idle.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('Job detail: not found and failed (change 20)', () => {
  it('says the job is no longer on the list when it is not found', async () => {
    mockJob(null);
    await render(<JobDetail/>);
    expect(screen.getByText('This job is no longer on your list')).toBeTruthy();
    expect(screen.getByText('Dispatch may have cancelled or reassigned it.')).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();
    await fireEvent.press(screen.getByText('Back to jobs'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'));
  });

  it('still shows the error and Retry when the load failed', async () => {
    const refetch = jest.fn();
    mockJob(undefined, { isError: true, error: new Error('Network request failed'), refetch });
    await render(<JobDetail/>);
    expect(screen.getByText('No signal. Check your connection and try again.')).toBeTruthy();
    expect(screen.queryByText('Network request failed')).toBeNull();
    expect(screen.queryByText('This job is no longer on your list')).toBeNull();
    await fireEvent.press(screen.getByText('Retry'));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });
});

describe('Job detail: Reject asks first (matches the Jobs list)', () => {
  const reject = jest.fn();
  beforeEach(() => {
    reject.mockReset().mockResolvedValue(undefined);
    (useRejectAssignment as jest.Mock).mockReturnValue({ mutateAsync: reject, isPending: false });
    mockJob(job({ status: 'pending' }));
  });

  async function openDialog() {
    await render(<JobDetail/>);
    await fireEvent.press(screen.getByText('Reject'));
    await screen.findByText('Reject JOB-137?');
  }

  it('opens the dialog with the agreed words and sends nothing yet', async () => {
    await openDialog();
    expect(screen.getByText('Dispatch will give it to another driver.')).toBeTruthy();
    expect(screen.getByText('Keep job')).toBeTruthy();
    expect(screen.getByText('Reject job')).toBeTruthy();
    expect(screen.getByText('Reason (optional)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Dispatch will see this.')).toBeTruthy();
    expect(reject).not.toHaveBeenCalled();
  });

  it('Keep job sends nothing', async () => {
    await openDialog();
    await fireEvent.press(screen.getByText('Keep job'));
    await waitFor(() => expect(screen.queryByText('Reject JOB-137?')).toBeNull());
    expect(reject).not.toHaveBeenCalled();
  });

  it('sends the typed reason', async () => {
    await openDialog();
    await fireEvent.changeText(screen.getByPlaceholderText('Dispatch will see this.'), 'Car in the workshop');
    await fireEvent.press(screen.getByText('Reject job'));
    await waitFor(() => expect(reject).toHaveBeenCalledWith({ assignmentId: 'asg-1', reason: 'Car in the workshop' }));
  });

  it('sends no reason (undefined) when the box is empty', async () => {
    await openDialog();
    await fireEvent.press(screen.getByText('Reject job'));
    await waitFor(() => expect(reject).toHaveBeenCalledWith({ assignmentId: 'asg-1', reason: undefined }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });
});

// Change 33: every clock follows the Time format setting.
describe('JobDetail with the Time format setting', () => {
  afterEach(() => resetClockStyleForTests());
  it('shows the stop time in the chosen style', async () => {
    mockJob(job({ status: 'confirmed', stops: [stop({ scheduledAt: PICKUP_AT })] }));
    await render(<JobDetail/>);
    expect(screen.getAllByText('09:15').length).toBeGreaterThan(0);
    await act(async () => { setClockStyle('12h'); });
    expect(screen.getAllByText('9:15 am').length).toBeGreaterThan(0);
    expect(screen.queryByText('09:15')).toBeNull();
  });
});

describe('Job detail: one Job status rule (lib/jobStatus.ts)', () => {
  const words = ['Accept', 'Reject', 'On my way', 'Open active job', 'Back to jobs'];
  const shown = () => words.filter((w) => screen.queryByText(w));

  it.each([
    ['pending', 'Pending', ['Accept', 'Reject']],
    ['confirmed', 'Confirmed', ['On my way']],
    ['in_progress', 'In Progress', ['Open active job']],
    ['done', 'Done', ['Back to jobs']],
    ['rejected', 'Rejected', ['Back to jobs']],
    ['cancelled', 'Cancelled', ['Back to jobs']],
    ['on_hold', 'On hold', ['Back to jobs']],
  ])('%s reads "%s" and offers only %j', async (status, word, actions) => {
    mockJob(job({ status }));
    await render(<JobDetail/>);
    expect(screen.getByText(word)).toBeTruthy();
    expect(screen.queryByText('Voided')).toBeNull();
    expect(shown()).toEqual(actions);
  });
});

// Value: protects=a Pending job with no assignment offers no Accept/Reject (they would call confirm with an undefined assignment); fails_when=the Pending buttons stop checking assignmentId; why_new=the status table always uses a fixture that has an assignment; seam=none; no_claim=does not say what the driver should see instead (today: nothing, not even Back to jobs)
// Generated by /ship coverage audit.
describe('Job detail: Pending with no assignment', () => {
  it('shows the Pending pill and nothing actionable', async () => {
    mockJob(job({ status: 'pending', assignmentId: null }));
    await render(<JobDetail/>);
    expect(screen.getByText('Pending')).toBeTruthy();
    for (const w of ['Accept', 'Reject', 'On my way', 'Open active job', 'Back to jobs']) {
      expect(screen.queryByText(w)).toBeNull();
    }
  });
});

// A failed button press shows the plain sentence under the same title, never the server's own text.
describe('Job detail: a failed action shows plain words', () => {
  const RAW = 'Cannot start a pending job (must be confirmed)';
  let alertSpy: jest.SpyInstance;
  beforeEach(() => { alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
  afterEach(() => alertSpy.mockRestore());

  it('Accept: dispatch changed the job', async () => {
    const confirmFail = jest.fn().mockRejectedValue({ message: RAW, code: 'P0001' });
    (useConfirmAssignment as jest.Mock).mockReturnValue({ mutateAsync: confirmFail, isPending: false });
    mockJob(job({ status: 'pending' }));
    await render(<JobDetail/>);
    await fireEvent.press(screen.getByText('Accept'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Could not confirm', "Dispatch has changed this job. It's been updated on your screen."));
    expect(alertSpy).not.toHaveBeenCalledWith('Could not confirm', RAW);
  });

  it('On my way: no signal', async () => {
    const startFail = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    (useStartJob as jest.Mock).mockReturnValue({ mutateAsync: startFail, isPending: false });
    await render(<JobDetail/>);
    await fireEvent.press(screen.getByText('On my way'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Could not start', 'No signal. Check your connection and try again.'));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('Reject: something unrecognised', async () => {
    const rejectFail = jest.fn().mockRejectedValue(new Error('boom'));
    (useRejectAssignment as jest.Mock).mockReturnValue({ mutateAsync: rejectFail, isPending: false });
    mockJob(job({ status: 'pending' }));
    await render(<JobDetail/>);
    await fireEvent.press(screen.getByText('Reject'));
    await fireEvent.press(await screen.findByText('Reject job'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Could not reject', 'Something went wrong. Try again, or call dispatch if it keeps happening.'));
    expect(alertSpy).not.toHaveBeenCalledWith('Could not reject', 'boom');
  });
});
