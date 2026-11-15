import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { TimelineStop, type Stop } from '../TimelineStop';

// NOTE: RNTL v14's `render` is async. Always await it.

const stop = (over: Partial<Stop> = {}): Stop => ({
  kind: 'Pickup',
  arrive: '09:15',
  place: 'KLIA, Arrivals',
  ...over,
});

describe('TimelineStop', () => {
  it('shows the stop name, its time and its place', async () => {
    await render(<TimelineStop stop={stop()} isLast={false}/>);
    expect(screen.getByText('Pickup')).toBeTruthy();
    expect(screen.getByText('09:15')).toBeTruthy();
    expect(screen.getByText('KLIA, Arrivals')).toBeTruthy();
  });

  it('shows no time line at all when the stop has no time (no "—: —")', async () => {
    await render(<TimelineStop stop={stop({ kind: 'Stop 1', arrive: null })} isLast={false}/>);
    expect(screen.getByText('Stop 1')).toBeTruthy();
    expect(screen.queryByText(/—/)).toBeNull();
    expect(screen.queryByText(/Arrive/)).toBeNull();
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).toBeNull();
  });

  it('writes the last stop as Drop-off', async () => {
    await render(<TimelineStop stop={stop({ kind: 'Drop-off', arrive: null })} isLast/>);
    expect(screen.getByText('Drop-off')).toBeTruthy();
  });
});
