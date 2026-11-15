import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
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
  mockJob(job({ rawStatus: 'confirmed', status: 'confirmed' }));
});

describe('Job detail: the route (changes 16 and 17)', () => {
  it('counts the stops beside the Route heading', async () => {
    await render(<JobDetail/>);
    expect(screen.getByText('Route')).toBeTruthy();
    expect(screen.getByText('3 stops')).toBeTruthy();
  });

  it('says "1 stop", not "1 stops"', async () => {
    mockJob(job({ rawStatus: 'confirmed', stops: [stop({ scheduledAt: PICKUP_AT })] }));
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
    expect(screen.getByText('Network request failed')).toBeTruthy();
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
    mockJob(job({ rawStatus: 'pending', status: 'pending' }));
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
