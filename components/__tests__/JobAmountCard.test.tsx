import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { JobAmountCard } from '../JobAmountCard';

// The fare card on Job Detail and Active Job. Its sub-label is the thing under
// test: this card shows the CLIENT's fare, and what it invites the driver to do
// with that number has to change when their own pay isn't derived from it.
//
// NOTE: RNTL v14's `render` is async (React 19) — always await it.

describe('JobAmountCard', () => {
  it('renders nothing when the job has no fare set', async () => {
    // A fixed-fee job legitimately has none (fleetms decision D1), which is why
    // the commission card is rendered independently of this one.
    const { toJSON } = await render(<JobAmountCard amount={null} commission={null}/>);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when the fare is undefined', async () => {
    const { toJSON } = await render(<JobAmountCard amount={undefined} commission={null}/>);
    expect(toJSON()).toBeNull();
  });

  it('shows the fare to sen, labelled as the job amount', async () => {
    await render(<JobAmountCard amount={500} commission={null}/>);
    expect(screen.getByText('Job amount')).toBeTruthy();
    expect(screen.getByText('RM 500.00')).toBeTruthy();
  });

  it('calls the fare a commission base on a standard job', async () => {
    // True in percentage mode: the driver's pay really is derived from this
    // number, so naming it the base is the honest description.
    await render(<JobAmountCard amount={500} commission={null}/>);
    expect(screen.getByText('Before commission')).toBeTruthy();
  });

  it('still calls it a commission base on a percentage-override job', async () => {
    await render(<JobAmountCard amount={500} commission={{ kind: 'rate', pct: 20 }}/>);
    expect(screen.getByText('Before commission')).toBeTruthy();
  });

  it('stops inviting percentage math on a fixed-fee job', async () => {
    // "RM 500 / Before commission" over a RM 80 flat fee is an instruction to
    // take a percentage of 500 — the exact ~RM 100 mistake the fixed mode
    // exists to prevent. The fare is still shown; it just stops claiming to be
    // what the driver's pay comes out of.
    await render(<JobAmountCard amount={500} commission={{ kind: 'fixed', amount: 80 }}/>);
    expect(screen.getByText('RM 500.00')).toBeTruthy();
    expect(screen.queryByText('Before commission')).toBeNull();
    expect(screen.getByText('What the client pays — not your fee')).toBeTruthy();
  });
});
