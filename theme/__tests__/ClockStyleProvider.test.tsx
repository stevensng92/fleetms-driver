import React from 'react';
import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClockStyleProvider, useClockStyle, CLOCK_STYLE_KEY } from '../ClockStyleProvider';
import { formatClock, setClockStyle } from '../../lib/timeFormat';

// 06:30Z is 14:30 in Malaysia.
const PICKUP = '2026-07-30T06:30:00Z';

function Probe() {
  const { clockStyle, setClockStyle: choose } = useClockStyle();
  return (
    <>
      <Text testID="style">{clockStyle}</Text>
      <Text testID="clock">{formatClock(PICKUP)}</Text>
      <Pressable testID="pick12" onPress={() => choose('12h')}><Text>12</Text></Pressable>
    </>
  );
}

function renderWith(qc = new QueryClient()) {
  return render(
    <QueryClientProvider client={qc}>
      <ClockStyleProvider><Probe/></ClockStyleProvider>
    </QueryClientProvider>,
  );
}

describe('ClockStyleProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setClockStyle('24h');
  });

  it('starts on 24h when nothing is stored', async () => {
    await renderWith();
    expect(screen.getByTestId('style').props.children).toBe('24h');
    expect(screen.getByTestId('clock').props.children).toBe('14:30 pm');
  });

  it('restores a stored 12h choice on launch', async () => {
    await AsyncStorage.setItem(CLOCK_STYLE_KEY, '12h');
    await renderWith();
    await waitFor(() => expect(screen.getByTestId('clock').props.children).toBe('2:30 pm'));
  });

  it('saves a new choice, re-renders clocks and refetches cached labels', async () => {
    const qc = new QueryClient();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    await renderWith(qc);
    fireEvent.press(screen.getByTestId('pick12'));
    await waitFor(() => expect(screen.getByTestId('clock').props.children).toBe('2:30 pm'));
    expect(await AsyncStorage.getItem(CLOCK_STYLE_KEY)).toBe('12h');
    expect(invalidate).toHaveBeenCalled();
  });
});
