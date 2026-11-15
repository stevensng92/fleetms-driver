import React from 'react';
import { render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { StatusPill, settleFrame, withAlpha } from '../StatusPill';
import { FeatureCard } from '../FeatureCard';
import { makeTokens } from '../../theme/tokens';

// Spy on the three reanimated calls the pill makes, and let a test flip Reduce Motion.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    withTiming: jest.fn(actual.withTiming),
    withRepeat: jest.fn(actual.withRepeat),
    cancelAnimation: jest.fn(actual.cancelAnimation),
    useReducedMotion: jest.fn(() => false),
  };
});

const R = Reanimated as unknown as {
  withTiming: jest.Mock; withRepeat: jest.Mock; cancelAnimation: jest.Mock; useReducedMotion: jest.Mock;
};
const L = makeTokens('light');

beforeEach(() => {
  R.withTiming.mockClear();
  R.withRepeat.mockClear();
  R.cancelAnimation.mockClear();
  R.useReducedMotion.mockReturnValue(false);
});

describe('settleFrame / withAlpha (pure)', () => {
  it('settle starts at 0.4 opacity and 0.96 scale and ends at 1 and 1', () => {
    expect(settleFrame(0, false)).toEqual({ opacity: 0.4, scale: 0.96 });
    expect(settleFrame(1, false)).toEqual({ opacity: 1, scale: 1 });
  });
  it('under Reduce Motion it only fades', () => {
    expect(settleFrame(0, true)).toEqual({ opacity: 0.4, scale: 1 });
  });
  it('withAlpha turns a hex into rgba', () => {
    expect(withAlpha('#008FD6', 0.25)).toBe('rgba(0,143,214,0.25)');
  });
});

describe('StatusPill: new API', () => {
  it('is the soft pill with icon and word, tinted by tone', async () => {
    await render(<StatusPill kind="job" status="confirmed"/>);
    expect(screen.getByText('Confirmed')).toHaveStyle({ color: L.greenText });
    expect(screen.getByTestId('status-pill')).toHaveStyle({ height: 24, backgroundColor: L.greenSoft, borderRadius: 999 });
    expect(screen.getByTestId('status-pill-icon')).toBeTruthy();
  });

  it('a payment status uses the payment words', async () => {
    await render(<StatusPill kind="payment" status="refunded"/>);
    expect(screen.getByText('Refunded')).toHaveStyle({ color: L.redText });
  });

  it('an unknown status shows its word with no icon', async () => {
    await render(<StatusPill kind="job" status="Weird"/>);
    expect(screen.getByText('Weird')).toBeTruthy();
    expect(screen.queryByTestId('status-pill-icon')).toBeNull();
  });

  it('Done reads in the plain text colour, not grey', async () => {
    await render(<StatusPill kind="job" status="done"/>);
    expect(screen.getByText('Done')).toHaveStyle({ color: L.text });
  });

  it('Cancelled is struck through in text2', async () => {
    await render(<StatusPill kind="job" status="cancelled"/>);
    expect(screen.getByText('Cancelled')).toHaveStyle({ color: L.text2, textDecorationLine: 'line-through' });
  });

  it('onFeature uses the dark-card tints and onFeature text for Done / Cancelled', async () => {
    await render(<StatusPill kind="job" status="pending" onFeature/>);
    expect(screen.getByTestId('status-pill')).toHaveStyle({ backgroundColor: L.onFeatureStatus.amberSoft });
    await render(<StatusPill kind="job" status="done" onFeature/>);
    expect(screen.getAllByText('Done')[0]).toHaveStyle({ color: L.onFeature });
    await render(<StatusPill kind="job" status="cancelled" onFeature/>);
    expect(screen.getAllByText('Cancelled')[0]).toHaveStyle({ color: L.onFeature2 });
  });

  it('picks the dark tints by itself inside a FeatureCard', async () => {
    await render(<FeatureCard><StatusPill kind="job" status="confirmed"/></FeatureCard>);
    expect(screen.getByTestId('status-pill')).toHaveStyle({ backgroundColor: L.onFeatureStatus.greenSoft });
  });
});

describe('StatusPill: legacy API keeps today words', () => {
  it.each([
    ['pending', 'Pending'], ['confirmed', 'Confirmed'], ['progress', 'In Progress'], ['done', 'Done'],
    ['paid', 'Paid'], ['pendingPay', 'Pending'], ['voided', 'Voided'],
  ] as const)('%s reads %s', async (kind, word) => {
    await render(<StatusPill kind={kind}/>);
    expect(screen.getByText(word)).toBeTruthy();
    expect(screen.getByTestId('status-pill-icon')).toBeTruthy();
  });

  it('pendingPay is amber and voided is neutral', async () => {
    await render(<StatusPill kind="pendingPay"/>);
    expect(screen.getByTestId('status-pill')).toHaveStyle({ backgroundColor: L.amberSoft });
    await render(<StatusPill kind="voided"/>);
    expect(screen.getByTestId('status-pill')).toHaveStyle({ backgroundColor: L.neutralSoft });
  });

  it('accepts pulse and ignores it for non-live statuses', async () => {
    await render(<StatusPill kind="pending" pulse/>);
    expect(R.withRepeat).not.toHaveBeenCalled();
    expect(screen.queryByTestId('status-glow')).toBeNull();
  });
});

describe('StatusPill: In Progress glow', () => {
  it('breathes forever: a repeating, reversing opacity timing of 1.2s each way (2.4s a cycle)', async () => {
    await render(<StatusPill kind="job" status="in_progress"/>);
    expect(screen.getByTestId('status-glow')).toBeTruthy();
    expect(R.withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 1200 }));
    expect(R.withRepeat).toHaveBeenCalledWith(expect.anything(), -1, true);
  });

  it('the legacy "progress" kind glows too', async () => {
    await render(<StatusPill kind="progress"/>);
    expect(screen.getByTestId('status-glow')).toBeTruthy();
  });

  it('the halo is a blue box-shadow on a layer behind the pill, not on the pill', async () => {
    await render(<StatusPill kind="job" status="in_progress"/>);
    const halo = screen.getByTestId('status-glow');
    expect(halo).toHaveStyle({ borderRadius: 999, position: 'absolute' });
    expect(JSON.stringify(halo.props.style)).toContain('rgba(0,143,214,0.4)');
    expect(screen.getByTestId('status-pill').props.style).not.toHaveProperty('boxShadow');
  });

  it('does not glow for other statuses', async () => {
    await render(<StatusPill kind="job" status="confirmed"/>);
    expect(screen.queryByTestId('status-glow')).toBeNull();
    expect(R.withRepeat).not.toHaveBeenCalled();
  });

  it('under Reduce Motion it holds still with a faint static ring', async () => {
    R.useReducedMotion.mockReturnValue(true);
    await render(<StatusPill kind="job" status="in_progress"/>);
    expect(R.withRepeat).not.toHaveBeenCalled();
    const halo = screen.getByTestId('status-glow');
    expect(JSON.stringify(halo.props.style)).toContain('0px 0px 0px 2px rgba(0,143,214,0.25)');
  });

  it('cancels the animation when it unmounts', async () => {
    const { unmount } = await render(<StatusPill kind="job" status="in_progress"/>);
    R.cancelAnimation.mockClear();
    await unmount();
    expect(R.cancelAnimation).toHaveBeenCalled();
  });

  it('stops the glow when the status moves on from In Progress', async () => {
    const { rerender } = await render(<StatusPill kind="job" status="in_progress"/>);
    await rerender(<StatusPill kind="job" status="done"/>);
    expect(screen.queryByTestId('status-glow')).toBeNull();
  });
});

describe('StatusPill: settle on change', () => {
  it('does not settle on the first render', async () => {
    await render(<StatusPill kind="job" status="pending"/>);
    expect(R.withTiming).not.toHaveBeenCalled();
  });

  it('does not settle when re-rendered with the same status', async () => {
    const { rerender } = await render(<StatusPill kind="job" status="pending"/>);
    await rerender(<StatusPill kind="job" status="pending"/>);
    expect(R.withTiming).not.toHaveBeenCalled();
  });

  it('settles over 200ms when the status changes', async () => {
    const { rerender } = await render(<StatusPill kind="job" status="pending"/>);
    await rerender(<StatusPill kind="job" status="confirmed"/>);
    expect(R.withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 200 }));
  });

  it('settles under Reduce Motion too (it fades only; see settleFrame)', async () => {
    R.useReducedMotion.mockReturnValue(true);
    const { rerender } = await render(<StatusPill kind="job" status="pending"/>);
    await rerender(<StatusPill kind="job" status="confirmed"/>);
    expect(R.withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 200 }));
  });
});
