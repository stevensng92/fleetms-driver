import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CommissionPill } from '../CommissionPill';

// The pill is the one place a driver learns a job doesn't pay their normal cut.
// It renders on the Jobs list, on Earnings rows, and (compact) inside
// CommissionRateCard — so both label modes and both pricing modes need pinning.
//
// NOTE: @testing-library/react-native v14 made `render` ASYNC (React 19
// concurrent rendering). Every render must be awaited; forgetting it fails with
// the confusing "toJSON is not a function" / "`render` function has not been
// called" pair rather than anything about promises.

describe('CommissionPill — absent', () => {
  it('renders nothing when the job pays the standard rate', async () => {
    // Callers drop this in unguarded, so null MUST be a no-op rather than a
    // stray empty pill on every ordinary job.
    const { toJSON } = await render(<CommissionPill commission={null}/>);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when commission is undefined', async () => {
    const { toJSON } = await render(<CommissionPill commission={undefined}/>);
    expect(toJSON()).toBeNull();
  });
});

describe('CommissionPill — percentage', () => {
  it('labels the rate with "comm" when standing alone', async () => {
    await render(<CommissionPill commission={{ kind: 'rate', pct: 20 }}/>);
    expect(screen.getByText('20% comm')).toBeTruthy();
  });

  it('drops the "comm" suffix in compact mode', async () => {
    // Used inside CommissionRateCard, whose own label already says
    // "Commission rate" — the suffix would say commission twice.
    await render(<CommissionPill commission={{ kind: 'rate', pct: 20 }} compact/>);
    expect(screen.getByText('20%')).toBeTruthy();
    expect(screen.queryByText('20% comm')).toBeNull();
  });

  it('strips trailing zeros in the label', async () => {
    await render(<CommissionPill commission={{ kind: 'rate', pct: 12.5 }}/>);
    expect(screen.getByText('12.5% comm')).toBeTruthy();
  });

  it('renders a 0% rate rather than treating it as absent', async () => {
    await render(<CommissionPill commission={{ kind: 'rate', pct: 0 }}/>);
    expect(screen.getByText('0% comm')).toBeTruthy();
  });
});

describe('CommissionPill — fixed fee', () => {
  it('labels a flat fee as money, with the mode named', async () => {
    // "RM 80" alone, on a card whose other figure is a RM 500 fare, is exactly
    // the ambiguity this variant exists to remove.
    await render(<CommissionPill commission={{ kind: 'fixed', amount: 80 }}/>);
    expect(screen.getByText('RM 80 flat')).toBeTruthy();
  });

  it('never renders a fee with a percent sign', async () => {
    // The shipped bug this replaces was a fixed job rendering NOTHING and being
    // read as the org rate. Rendering the fee AS a rate would be worse.
    await render(<CommissionPill commission={{ kind: 'fixed', amount: 20 }}/>);
    expect(screen.queryByText('20%')).toBeNull();
    expect(screen.queryByText('20% comm')).toBeNull();
    expect(screen.getByText('RM 20 flat')).toBeTruthy();
  });

  it('keeps sen on a fee that has them', async () => {
    await render(<CommissionPill commission={{ kind: 'fixed', amount: 82.5 }}/>);
    expect(screen.getByText('RM 82.50 flat')).toBeTruthy();
  });

  it('drops the "flat" suffix in compact mode', async () => {
    await render(<CommissionPill commission={{ kind: 'fixed', amount: 80 }} compact/>);
    expect(screen.getByText('RM 80')).toBeTruthy();
    expect(screen.queryByText('RM 80 flat')).toBeNull();
  });

  it('renders a RM 0 fee rather than treating it as absent', async () => {
    await render(<CommissionPill commission={{ kind: 'fixed', amount: 0 }}/>);
    expect(screen.getByText('RM 0 flat')).toBeTruthy();
  });
});
