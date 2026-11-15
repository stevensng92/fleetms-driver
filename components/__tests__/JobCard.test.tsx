import React from 'react';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { JobCard, type Job } from '../JobCard';

// expo-haptics is stubbed globally in test/setup.ts.

const job = (over: Partial<Job> = {}): Job => ({
  id: 'JOB-101', assignmentId: 'asg-1', time: '14:30', vehicle: 'WXY 1234',
  from: 'KLIA', to: 'Bukit Bintang', client: 'Acme Sdn Bhd', pax: 2, status: 'pending', ...over,
});

const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

beforeEach(() => jest.clearAllMocks());

describe('JobCard: lines folded into the card (change 19)', () => {
  it('a confirmed card has no View details button', async () => {
    await render(<JobCard job={job({ status: 'confirmed' })}/>);
    expect(screen.queryByText(/view details/i)).toBeNull();
  });
  it('a done card has no Completed line', async () => {
    await render(<JobCard job={job({ status: 'done' })}/>);
    expect(screen.queryByText('Completed')).toBeNull();
    expect(screen.getByText('Done')).toBeTruthy();
  });
  it('a cancelled job reads Cancelled, not Voided', async () => {
    await render(<JobCard job={job({ status: 'voided', rawStatus: 'cancelled' })}/>);
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.queryByText('Voided')).toBeNull();
  });
  it('a voided job with no raw status still reads Voided', async () => {
    await render(<JobCard job={job({ status: 'voided' })}/>);
    expect(screen.getByText('Voided')).toBeTruthy();
  });
  it('a rejected job reads Rejected', async () => {
    await render(<JobCard job={job({ status: 'voided', rawStatus: 'rejected' })}/>);
    expect(screen.getByText('Rejected')).toBeTruthy();
  });
});

describe('JobCard: Accept (change 35)', () => {
  it('fires a light success haptic on the tap, then accepts once the buttons have faded', async () => {
    const onAccept = jest.fn();
    await render(<JobCard job={job()} onAccept={onAccept}/>);
    await fireEvent.press(screen.getByText('Accept'));
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(onAccept).not.toHaveBeenCalled(); // not before the fade is over
    await waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
  });

  it('ignores a second Accept tap during the fade: accept fires once, haptic once', async () => {
    const onAccept = jest.fn();
    await render(<JobCard job={job()} onAccept={onAccept}/>);
    await fireEvent.press(screen.getByText('Accept'));
    await fireEvent.press(screen.getByText('Accept'));
    await wait(300);
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it('locks Reject too while the buttons fade', async () => {
    const onReject = jest.fn();
    await render(<JobCard job={job()} onAccept={jest.fn()} onReject={onReject}/>);
    await fireEvent.press(screen.getByText('Accept'));
    await fireEvent.press(screen.getByText('Reject'));
    await wait(200);
    expect(onReject).not.toHaveBeenCalled();
  });

  it('brings the buttons back when the accept failed', async () => {
    const onAccept = jest.fn().mockResolvedValue(false);
    await render(<JobCard job={job()} onAccept={onAccept}/>);
    await fireEvent.press(screen.getByText('Accept'));
    await waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
    await wait(50);
    await fireEvent.press(screen.getByText('Accept'));
    await waitFor(() => expect(onAccept).toHaveBeenCalledTimes(2));
  });

  it('Reject just calls onReject: the screen asks first', async () => {
    const onReject = jest.fn();
    await render(<JobCard job={job()} onReject={onReject}/>);
    await fireEvent.press(screen.getByText('Reject'));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});
