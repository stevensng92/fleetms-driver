import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import TimeOff from '../../app/profile/time-off';
import { useRequestTimeOff } from '../../lib/mutations/timeOff';

// RNTL v14: render and fireEvent are async; await every one.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
// The mutation module builds a live Supabase client at import, so it is mocked.
jest.mock('../../lib/mutations/timeOff', () => ({ useRequestTimeOff: jest.fn() }));
// A stand-in for the calendar so a test can tap named days: it draws one button
// per day and prints which days the screen marked. The real calendar is still
// what the screen uses; only the days it offers are fixed here.
jest.mock('react-native-calendars', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  const DAYS = ['2030-03-05', '2030-03-10', '2030-03-12'];
  return {
    Calendar: ({ onDayPress, markedDates }: any) => (
      <View>
        {DAYS.map((d) => (
          <Pressable key={d} accessibilityLabel={`day ${d}`} onPress={() => onDayPress({ dateString: d })}>
            <Text>{d.slice(8)}</Text>
          </Pressable>
        ))}
        <Text testID="marked">{Object.keys(markedDates).join(',')}</Text>
      </View>
    ),
  };
});

const mutateAsync = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  mutateAsync.mockResolvedValue('id');
  (useRequestTimeOff as jest.Mock).mockReturnValue({ mutateAsync, isPending: false });
});

const tap = (d: string) => fireEvent.press(screen.getByLabelText(`day ${d}`));
const submit = () => fireEvent.press(screen.getByText('Submit request'));

describe('Request time off (change 24)', () => {
  it('can be pressed with nothing picked, and says what is missing', async () => {
    await render(<TimeOff/>);
    await submit();
    expect(screen.getByText('Pick the first day off.')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('takes one tap as a one-day request, with the nudge toward a later day', async () => {
    await render(<TimeOff/>);
    await tap('2030-03-10');
    expect(screen.getAllByText('10 Mar 2030')).toHaveLength(2);
    expect(screen.getByText('1 day requested. Tap a later day for more than one.')).toBeTruthy();
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({ startDate: '2030-03-10', endDate: '2030-03-10', reason: 'leave', notes: '' });
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('makes a range from a second tap on a later day', async () => {
    await render(<TimeOff/>);
    await tap('2030-03-10');
    await tap('2030-03-12');
    expect(screen.getByText('3 days requested, awaiting dispatcher approval.')).toBeTruthy();
    expect(screen.getByTestId('marked').props.children).toBe('2030-03-10,2030-03-11,2030-03-12');
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2030-03-10', endDate: '2030-03-12' })));
  });

  it('moves a one-day request when an earlier day is tapped', async () => {
    await render(<TimeOff/>);
    await tap('2030-03-10');
    await tap('2030-03-05');
    expect(screen.getAllByText('5 Mar 2030')).toHaveLength(2);
    expect(screen.getByTestId('marked').props.children).toBe('2030-03-05');
  });

  it('starts again on a tap after a range', async () => {
    await render(<TimeOff/>);
    await tap('2030-03-10');
    await tap('2030-03-12');
    await tap('2030-03-05');
    expect(screen.getByText('1 day requested. Tap a later day for more than one.')).toBeTruthy();
    expect(screen.getByTestId('marked').props.children).toBe('2030-03-05');
  });

  it('clears the missing-day message once a day is picked', async () => {
    await render(<TimeOff/>);
    await submit();
    expect(screen.getByText('Pick the first day off.')).toBeTruthy();
    await tap('2030-03-10');
    expect(screen.queryByText('Pick the first day off.')).toBeNull();
  });
});
