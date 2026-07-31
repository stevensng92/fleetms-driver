import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CommissionRateCard } from '../CommissionRateCard';

// The detail-screen treatment of a non-standard rate, shared by Job Detail and
// Active Job. Neither screen has tests, so this is the only thing pinning the
// card's behaviour.
//
// NOTE: RNTL v14's `render` is async (React 19) — always await it.

describe('CommissionRateCard', () => {
  it('renders nothing when the job pays the standard rate', async () => {
    const { toJSON } = await render(<CommissionRateCard pct={null}/>);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when pct is undefined', async () => {
    const { toJSON } = await render(<CommissionRateCard pct={undefined}/>);
    expect(toJSON()).toBeNull();
  });

  it('explains itself, not just the number', async () => {
    // The caption is the only thing telling a driver the rate is a fact rather
    // than an error. If it goes, the card is a bare percentage in red.
    await render(<CommissionRateCard pct={20}/>);
    expect(screen.getByText('Commission rate')).toBeTruthy();
    expect(screen.getByText('Different from your usual rate')).toBeTruthy();
  });

  it('renders the pill in compact mode so "commission" is not said twice', async () => {
    // The card label already says "Commission rate"; a "20% comm" pill beside
    // it repeats the word. This is the whole reason `compact` exists.
    await render(<CommissionRateCard pct={20}/>);
    expect(screen.getByText('20%')).toBeTruthy();
    expect(screen.queryByText('20% comm')).toBeNull();
  });

  it('renders a 0% rate rather than treating it as absent', async () => {
    await render(<CommissionRateCard pct={0}/>);
    expect(screen.getByText('0%')).toBeTruthy();
  });
});
