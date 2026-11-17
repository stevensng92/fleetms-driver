import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LoadError } from '../LoadError';

// NOTE: RNTL v14's `render` is async. Always await it.

describe('LoadError', () => {
  it('shows the title and the plain sentence, never the raw message', async () => {
    await render(<LoadError title="Couldn't load job" error={new TypeError('Failed to fetch')} onRetry={() => {}}/>);
    expect(screen.getByText("Couldn't load job")).toBeTruthy();
    expect(screen.getByText('No signal. Check your connection and try again.')).toBeTruthy();
    expect(screen.queryByText('Failed to fetch')).toBeNull();
  });

  it('says something went wrong for an error it does not know', async () => {
    await render(<LoadError title="Couldn't load job" error={null} onRetry={() => {}}/>);
    expect(screen.getByText('Something went wrong. Try again, or call dispatch if it keeps happening.')).toBeTruthy();
  });

  it('reloads when the driver taps Retry', async () => {
    const onRetry = jest.fn();
    await render(<LoadError title="Couldn't load job" error={new TypeError('Failed to fetch')} onRetry={onRetry}/>);
    await fireEvent.press(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows extra content under the message', async () => {
    await render(
      <LoadError title="Couldn't load jobs" error={new Error('x')} onRetry={() => {}}>
        <Text>Auth status: no-creds</Text>
      </LoadError>,
    );
    expect(screen.getByText('Auth status: no-creds')).toBeTruthy();
  });
});
