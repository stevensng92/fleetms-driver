import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Band } from '../Band';
import { makeTokens } from '../../theme/tokens';

const L = makeTokens('light');

describe('Band', () => {
  it('is a soft band: tone tint, tone text, radius 16, padding 12/14', async () => {
    await render(<Band tone="amber" testID="b">Heads up</Band>);
    expect(screen.getByTestId('b')).toHaveStyle({
      backgroundColor: L.amberSoft, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14,
    });
    expect(screen.getByText('Heads up')).toHaveStyle({ color: L.amberText });
  });

  it('neutral sits on the sunk surface with text2', async () => {
    await render(<Band tone="neutral" testID="b">Fyi</Band>);
    expect(screen.getByTestId('b')).toHaveStyle({ backgroundColor: L.surfaceSunk });
    expect(screen.getByText('Fyi')).toHaveStyle({ color: L.text2 });
  });

  it.each([['red', 'redSoft', 'redText'], ['blue', 'blueSoft', 'blueText'], ['green', 'greenSoft', 'greenText']] as const)(
    '%s uses its soft tint and text', async (tone, soft, text) => {
      await render(<Band tone={tone} testID="b">Words</Band>);
      expect(screen.getByTestId('b')).toHaveStyle({ backgroundColor: L[soft] });
      expect(screen.getByText('Words')).toHaveStyle({ color: L[text] });
    });

  it('always has an icon, with a default per tone', async () => {
    for (const tone of ['amber', 'red', 'neutral', 'blue', 'green'] as const) {
      await render(<Band tone={tone} testID={`b-${tone}`}>x</Band>);
      expect(screen.getByTestId(`b-${tone}-icon`)).toBeTruthy();
    }
  });

  it('takes a custom icon', async () => {
    await render(<Band tone="amber" icon="clock" testID="b">x</Band>);
    expect(screen.getByTestId('b-icon')).toBeTruthy();
  });

  it('shows an action node on the right', async () => {
    await render(<Band tone="red" action={<Text>Retry</Text>}>x</Band>);
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('has no action slot without one', async () => {
    await render(<Band tone="red" testID="b">x</Band>);
    expect(screen.queryByTestId('b-action')).toBeNull();
  });
});

describe('Band: node children', () => {
  it('renders a node as is', async () => {
    await render(<Band tone="blue"><Text>Custom node</Text></Band>);
    expect(screen.getByText('Custom node')).toBeTruthy();
  });
});
