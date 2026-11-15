import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Card } from '../Card';
import { makeTokens } from '../../theme/tokens';

const L = makeTokens('light');

describe('Card', () => {
  it('is a surface card: radius 24, shadow1, no border, no stripe', async () => {
    await render(<Card testID="c"><Text>x</Text></Card>);
    const style = screen.getByTestId('c').props.style;
    expect(screen.getByTestId('c')).toHaveStyle({ backgroundColor: L.surface, borderRadius: 24, boxShadow: L.shadow1, opacity: 1 });
    expect(JSON.stringify(style)).not.toMatch(/border(Left)?Width/);
  });

  it('legacy accent is accepted but draws no stripe', async () => {
    await render(<Card testID="c" accent="#ff0000"><Text>x</Text></Card>);
    expect(JSON.stringify(screen.getByTestId('c').props.style)).not.toContain('#ff0000');
  });

  it('legacy pulse is accepted and does nothing', async () => {
    await render(<Card testID="c" accent="#f00" pulse><Text>x</Text></Card>);
    expect(screen.getByTestId('c')).toHaveStyle({ opacity: 1 });
  });

  it('dim drops to opacity 0.6', async () => {
    await render(<Card testID="c" dim><Text>x</Text></Card>);
    expect(screen.getByTestId('c')).toHaveStyle({ opacity: 0.6 });
  });

  it('merges caller style', async () => {
    await render(<Card testID="c" style={{ padding: 14 }}><Text>x</Text></Card>);
    expect(screen.getByTestId('c')).toHaveStyle({ padding: 14 });
  });

  it('is not pressable without onPress', async () => {
    await render(<Card><Text>x</Text></Card>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<Card onPress={onPress}><Text>tap me</Text></Card>);
    await fireEvent.press(screen.getByText('tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
