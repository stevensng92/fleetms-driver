import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RouteCard } from '../RouteCard';
import { stop, PICKUP_AT, DROPOFF_AT } from '../../test/jobFixtures';

// NOTE: RNTL v14's `render` is async. Always await it.
// PICKUP_AT is 09:15 and DROPOFF_AT 14:05 on the Malaysia clock.

describe('RouteCard', () => {
  it('names the stops Pickup, Stop 1, Stop 2, Drop-off with no gaps', async () => {
    // The database's own middle labels have a gap (Stop 2, Stop 4): the card counts them itself.
    await render(<RouteCard stops={[
      stop({ kind: 'Pickup', location: 'KLIA' }),
      stop({ kind: 'Stop 2', location: 'Mid Valley' }),
      stop({ kind: 'Stop 4', location: 'Bangsar' }),
      stop({ kind: 'Dropoff', location: 'Pavilion KL' }),
    ]}/>);
    expect(screen.getByText('Route')).toBeTruthy();
    expect(screen.getByText('Pickup')).toBeTruthy();
    expect(screen.getByText('Stop 1')).toBeTruthy();
    expect(screen.getByText('Stop 2')).toBeTruthy();
    expect(screen.queryByText('Stop 4')).toBeNull();
    expect(screen.getByText('Drop-off')).toBeTruthy();
    expect(screen.getByText('4 stops')).toBeTruthy();
  });

  it('says "1 stop" for a single stop', async () => {
    await render(<RouteCard stops={[stop({ kind: 'Pickup' })]}/>);
    expect(screen.getByText('1 stop')).toBeTruthy();
  });

  it('shows the place with its detail', async () => {
    await render(<RouteCard stops={[stop({ kind: 'Pickup', location: 'KLIA', detail: 'Door 4' })]}/>);
    expect(screen.getByText('KLIA, Door 4')).toBeTruthy();
  });

  it('shows no time for a stop without one', async () => {
    await render(<RouteCard stops={[stop({ kind: 'Pickup', scheduledAt: null })]}/>);
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).toBeNull();
  });

  it('writes the times in the 24-hour clock by default', async () => {
    await render(<RouteCard stops={[
      stop({ kind: 'Pickup', scheduledAt: PICKUP_AT }),
      stop({ kind: 'Dropoff', scheduledAt: DROPOFF_AT }),
    ]}/>);
    expect(screen.getByText('09:15')).toBeTruthy();
    expect(screen.getByText('14:05')).toBeTruthy();
  });

  it('writes the times in the 12-hour clock when asked', async () => {
    await render(<RouteCard clock="12h" stops={[
      stop({ kind: 'Pickup', scheduledAt: PICKUP_AT }),
      stop({ kind: 'Dropoff', scheduledAt: DROPOFF_AT }),
    ]}/>);
    expect(screen.getByText(/9:15\s?AM/i)).toBeTruthy();
    expect(screen.getByText(/2:05\s?PM/i)).toBeTruthy();
  });
});
