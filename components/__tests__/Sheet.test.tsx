import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Sheet } from '../Sheet';

describe('Sheet', () => {
  it('shows its title and children when visible', async () => {
    await render(<Sheet visible onClose={jest.fn()} title="Pick a vehicle"><Text>Toyota Vellfire</Text></Sheet>);
    expect(screen.getByText('Pick a vehicle')).toBeTruthy();
    expect(screen.getByText('Toyota Vellfire')).toBeTruthy();
  });

  it('draws nothing when not visible', async () => {
    await render(<Sheet visible={false} onClose={jest.fn()} title="Hidden"><Text>Body</Text></Sheet>);
    expect(screen.queryByText('Body')).toBeNull();
  });

  it('omits the title when there is none', async () => {
    await render(<Sheet visible onClose={jest.fn()}><Text>Body only</Text></Sheet>);
    expect(screen.getByText('Body only')).toBeTruthy();
    expect(screen.queryByRole('header')).toBeNull();
  });

  it('closes when the scrim is tapped', async () => {
    const onClose = jest.fn();
    await render(<Sheet visible onClose={onClose}><Text>Body</Text></Sheet>);
    await fireEvent.press(screen.getByLabelText('Close', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
