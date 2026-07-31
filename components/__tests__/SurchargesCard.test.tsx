import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SurchargesCard, type Surcharge } from '../SurchargesCard';

// The badge wording here is money-facing: it tells a driver whether a surcharge
// is theirs to keep, already settled, or folded into the commissionable fare.
// Getting it wrong means a driver argues the wrong number at the counter, so
// each mapping is pinned individually.
//
// NOTE: RNTL v14's `render` is async (React 19) — always await it.

const surcharge = (over: Partial<Surcharge> = {}): Surcharge => ({
  id: 's1',
  name: 'Overnight stay',
  amount: 80,
  treatment: 'pass_through',
  paidInAdvance: false,
  ...over,
});

describe('SurchargesCard', () => {
  it('renders nothing when the job carries no surcharges', async () => {
    // Most jobs have none — the section must disappear entirely, not leave an
    // empty "Included services" heading behind.
    const { toJSON } = await render(<SurchargesCard items={[]}/>);
    expect(toJSON()).toBeNull();
  });

  it('labels a pass-through surcharge as money added to the driver', async () => {
    await render(<SurchargesCard items={[surcharge({ treatment: 'pass_through' })]}/>);
    expect(screen.getByText('Added to your pay')).toBeTruthy();
  });

  it('labels a commissionable surcharge as counting toward the fare', async () => {
    await render(<SurchargesCard items={[surcharge({ treatment: 'commissionable' })]}/>);
    expect(screen.getByText('Counts toward fare')).toBeTruthy();
  });

  it.each(['pass_through', 'commissionable'] as const)(
    'lets paid-in-advance win over the %s label',
    async (treatment) => {
      // Cash already handed over is not owed again, whatever its
      // classification. Both treatments must read "Paid in advance".
      await render(<SurchargesCard items={[surcharge({ treatment, paidInAdvance: true })]}/>);
      expect(screen.getByText('Paid in advance')).toBeTruthy();
      expect(screen.queryByText('Added to your pay')).toBeNull();
      expect(screen.queryByText('Counts toward fare')).toBeNull();
    },
  );

  it('strikes through an amount that was already settled', async () => {
    await render(<SurchargesCard items={[surcharge({ paidInAdvance: true })]}/>);
    const amount = screen.getByText('RM 80.00');
    expect(amount.props.style).toEqual(
      expect.objectContaining({ textDecorationLine: 'line-through' }),
    );
  });

  it('leaves an unsettled amount un-struck', async () => {
    await render(<SurchargesCard items={[surcharge({ paidInAdvance: false })]}/>);
    const amount = screen.getByText('RM 80.00');
    expect(amount.props.style).toEqual(
      expect.objectContaining({ textDecorationLine: 'none' }),
    );
  });

  it('renders every surcharge with a 2dp amount', async () => {
    await render(
      <SurchargesCard
        items={[
          surcharge({ id: 'a', name: 'Overnight stay', amount: 80 }),
          surcharge({ id: 'b', name: 'Airport paging', amount: 30.5 }),
        ]}
      />,
    );
    expect(screen.getByText('Overnight stay')).toBeTruthy();
    expect(screen.getByText('Airport paging')).toBeTruthy();
    expect(screen.getByText('RM 80.00')).toBeTruthy();
    expect(screen.getByText('RM 30.50')).toBeTruthy();
  });
});
