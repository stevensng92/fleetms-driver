import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CommissionRateCard } from '../CommissionRateCard';

// The detail-screen treatment of non-standard pay, shared by Job Detail and
// Active Job. Neither screen has tests, so this is the only thing pinning the
// card's behaviour.
//
// NOTE: RNTL v14's `render` is async (React 19) — always await it.

describe('CommissionRateCard — absent', () => {
  it('renders nothing when the job pays the standard rate', async () => {
    const { toJSON } = await render(<CommissionRateCard commission={null}/>);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when commission is undefined', async () => {
    const { toJSON } = await render(<CommissionRateCard commission={undefined}/>);
    expect(toJSON()).toBeNull();
  });
});

describe('CommissionRateCard — percentage', () => {
  it('explains itself, not just the number', async () => {
    // The caption is the only thing telling a driver the rate is a fact rather
    // than an error. If it goes, the card is a bare percentage.
    await render(<CommissionRateCard commission={{ kind: 'rate', pct: 20 }}/>);
    expect(screen.getByText('Commission rate')).toBeTruthy();
    expect(screen.getByText('Different from your usual rate')).toBeTruthy();
  });

  it('renders the pill in compact mode so "commission" is not said twice', async () => {
    // The card label already says "Commission rate"; a "20% comm" pill beside
    // it repeats the word. This is the whole reason `compact` exists.
    await render(<CommissionRateCard commission={{ kind: 'rate', pct: 20 }}/>);
    expect(screen.getByText('20%')).toBeTruthy();
    expect(screen.queryByText('20% comm')).toBeNull();
  });

  it('renders a 0% rate rather than treating it as absent', async () => {
    await render(<CommissionRateCard commission={{ kind: 'rate', pct: 0 }}/>);
    expect(screen.getByText('0%')).toBeTruthy();
  });
});

describe('CommissionRateCard — fixed fee', () => {
  it('says in words that the fare is not what the fee comes out of', async () => {
    // This caption is the entire reason the fixed variant exists. Without it a
    // RM 80 fee sits in a slot a driver has learned means "percentage", on a
    // screen whose other number is a RM 500 fare, and gets read as ~RM 100.
    await render(<CommissionRateCard commission={{ kind: 'fixed', amount: 80 }}/>);
    expect(screen.getByText('Your fee for this job')).toBeTruthy();
    expect(screen.getByText('Flat fee — not a percentage of the fare')).toBeTruthy();
  });

  it('does not reuse the percentage-mode wording', async () => {
    // "Commission rate / Different from your usual rate" over a flat fee is the
    // same mislead in a different font.
    await render(<CommissionRateCard commission={{ kind: 'fixed', amount: 80 }}/>);
    expect(screen.queryByText('Commission rate')).toBeNull();
    expect(screen.queryByText('Different from your usual rate')).toBeNull();
  });

  it('renders the fee compactly, with no percent sign', async () => {
    await render(<CommissionRateCard commission={{ kind: 'fixed', amount: 80 }}/>);
    expect(screen.getByText('RM 80')).toBeTruthy();
    expect(screen.queryByText('RM 80 flat')).toBeNull();
    expect(screen.queryByText('80%')).toBeNull();
  });

  it('renders a RM 0 fee rather than treating it as absent', async () => {
    await render(<CommissionRateCard commission={{ kind: 'fixed', amount: 0 }}/>);
    expect(screen.getByText('RM 0')).toBeTruthy();
  });
});
