import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { JobCard, type Job } from '../JobCard';

// expo-haptics is stubbed globally in test/setup.ts.

const job = (over: Partial<Job> = {}): Job => ({
  id: 'JOB-101', assignmentId: 'asg-1', time: '14:30', pickupAt: '2026-12-12T06:30:00Z', vehicle: 'WXY 1234',
  from: 'KLIA', to: 'Bukit Bintang', client: 'Acme Sdn Bhd', pax: 2, status: 'pending', ...over,
});

// Fake timers, so the 120ms fade never races the machine's speed. The async act flushes the awaited onAccept too.
const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

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
    await render(<JobCard job={job({ status: 'cancelled' })}/>);
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.queryByText('Voided')).toBeNull();
  });
  it("an unknown status shows the dispatcher's word and offers no Accept or Reject", async () => {
    await render(<JobCard job={job({ status: 'on_hold' })} onAccept={jest.fn()} onReject={jest.fn()}/>);
    expect(screen.getByText('On hold')).toBeTruthy();
    expect(screen.queryByText('Accept')).toBeNull();
    expect(screen.queryByText('Reject')).toBeNull();
  });
  it('a pending job offers Accept and Reject', async () => {
    await render(<JobCard job={job({ status: 'pending' })}/>);
    expect(screen.getByText('Accept')).toBeTruthy();
    expect(screen.getByText('Reject')).toBeTruthy();
  });
  it('a rejected job reads Rejected', async () => {
    await render(<JobCard job={job({ status: 'rejected' })}/>);
    expect(screen.getByText('Rejected')).toBeTruthy();
  });
});

describe('JobCard: Accept (change 35)', () => {
  beforeEach(() => { jest.useFakeTimers({ doNotFake: ['Date', 'performance'] }); });
  afterEach(() => { jest.useRealTimers(); });

  it('fires a light success haptic on the tap, then accepts once the buttons have faded', async () => {
    const onAccept = jest.fn();
    await render(<JobCard job={job()} onAccept={onAccept}/>);
    await fireEvent.press(screen.getByText('Accept'));
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(onAccept).not.toHaveBeenCalled(); // not before the fade is over
    await advance(119);
    expect(onAccept).not.toHaveBeenCalled();
    await advance(1);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('ignores a second Accept tap during the fade: accept fires once, haptic once', async () => {
    const onAccept = jest.fn();
    await render(<JobCard job={job()} onAccept={onAccept}/>);
    await fireEvent.press(screen.getByText('Accept'));
    await fireEvent.press(screen.getByText('Accept'));
    await advance(300);
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it('locks Reject too while the buttons fade', async () => {
    const onReject = jest.fn();
    await render(<JobCard job={job()} onAccept={jest.fn()} onReject={onReject}/>);
    await fireEvent.press(screen.getByText('Accept'));
    await fireEvent.press(screen.getByText('Reject'));
    await advance(200);
    expect(onReject).not.toHaveBeenCalled();
  });

  it('brings the buttons back when the accept failed', async () => {
    const onAccept = jest.fn().mockResolvedValue(false);
    await render(<JobCard job={job()} onAccept={onAccept}/>);
    await fireEvent.press(screen.getByText('Accept'));
    await advance(120);
    expect(onAccept).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('Accept'));
    await advance(120);
    expect(onAccept).toHaveBeenCalledTimes(2);
  });

  it('Reject just calls onReject: the screen asks first', async () => {
    const onReject = jest.fn();
    await render(<JobCard job={job()} onReject={onReject}/>);
    await fireEvent.press(screen.getByText('Reject'));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});

// Value: protects=only a pending card carries Accept/Reject and only an In progress card is the live one (glowing pill); fails_when=JobCard keys the action row or the live look off anything but jobStatus (e.g. shows Accept on every open job); why_new=existing JobCard tests cover words and pending buttons but not the live card or hideActions; seam=none; no_claim=does not check the dark FeatureCard styling
// Generated by /ship coverage audit.
describe('JobCard: action row and live card follow jobStatus', () => {
  it('an In progress card has a glowing pill and no Accept or Reject', async () => {
    await render(<JobCard job={job({ status: 'in_progress' })} onAccept={jest.fn()} onReject={jest.fn()}/>);
    expect(screen.getByText('In Progress')).toBeTruthy();
    expect(screen.getByTestId('status-glow')).toBeTruthy();
    expect(screen.queryByText('Accept')).toBeNull();
    expect(screen.queryByText('Reject')).toBeNull();
  });
  it('a confirmed card has no glow and no Accept or Reject', async () => {
    await render(<JobCard job={job({ status: 'confirmed' })}/>);
    expect(screen.queryByTestId('status-glow')).toBeNull();
    expect(screen.queryByText('Accept')).toBeNull();
  });
  it('hideActions hides Accept and Reject on a pending card', async () => {
    await render(<JobCard job={job({ status: 'pending' })} hideActions/>);
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.queryByText('Accept')).toBeNull();
  });
});
