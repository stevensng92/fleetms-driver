import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CommissionPill } from '../CommissionPill';

// The pill is the one place a driver learns a job pays a non-standard rate. It
// renders on the Jobs list, on Earnings rows, and (compact) inside
// CommissionRateCard — so its two label modes both need pinning.
//
// NOTE: @testing-library/react-native v14 made `render` ASYNC (React 19
// concurrent rendering). Every render must be awaited; forgetting it fails with
// the confusing "toJSON is not a function" / "`render` function has not been
// called" pair rather than anything about promises.

describe('CommissionPill', () => {
  it('renders nothing when the job pays the standard rate', async () => {
    // Callers drop this in unguarded, so null MUST be a no-op rather than a
    // stray empty pill on every ordinary job.
    const { toJSON } = await render(<CommissionPill pct={null}/>);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when pct is undefined', async () => {
    const { toJSON } = await render(<CommissionPill pct={undefined}/>);
    expect(toJSON()).toBeNull();
  });

  it('labels the rate with "comm" when standing alone', async () => {
    await render(<CommissionPill pct={20}/>);
    expect(screen.getByText('20% comm')).toBeTruthy();
  });

  it('drops the "comm" suffix in compact mode', async () => {
    // Used inside CommissionRateCard, whose own label already says
    // "Commission rate" — the suffix would say commission twice.
    await render(<CommissionPill pct={20} compact/>);
    expect(screen.getByText('20%')).toBeTruthy();
    expect(screen.queryByText('20% comm')).toBeNull();
  });

  it('strips trailing zeros in the label', async () => {
    await render(<CommissionPill pct={12.5}/>);
    expect(screen.getByText('12.5% comm')).toBeTruthy();
  });

  it('renders a 0% rate rather than treating it as absent', async () => {
    await render(<CommissionPill pct={0}/>);
    expect(screen.getByText('0% comm')).toBeTruthy();
  });
});
