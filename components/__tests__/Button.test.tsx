import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { Button } from '../Button';
import { makeTokens } from '../../theme/tokens';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    withTiming: jest.fn(actual.withTiming),
    useReducedMotion: jest.fn(() => false),
  };
});
const R = Reanimated as unknown as { withTiming: jest.Mock; useReducedMotion: jest.Mock };
const L = makeTokens('light');

beforeEach(() => {
  R.withTiming.mockClear();
  R.useReducedMotion.mockReturnValue(false);
});

describe('Button: look', () => {
  it('primary is an ink pill with onInk 14px semibold text, 44 tall', async () => {
    await render(<Button testID="b">Save</Button>);
    expect(screen.getByTestId('b')).toHaveStyle({ backgroundColor: L.ink, borderRadius: 999, minHeight: 44 });
    expect(screen.getByText('Save')).toHaveStyle({ color: L.onInk, fontSize: 14, fontWeight: '600' });
  });

  it('lg is 52 tall with 16px text', async () => {
    await render(<Button testID="b" size="lg">Save</Button>);
    expect(screen.getByTestId('b')).toHaveStyle({ minHeight: 52 });
    expect(screen.getByText('Save')).toHaveStyle({ fontSize: 16 });
  });

  it('secondary is a surface pill with shadow1', async () => {
    await render(<Button testID="b" variant="secondary">Back</Button>);
    expect(screen.getByTestId('b')).toHaveStyle({ backgroundColor: L.surface, boxShadow: L.shadow1 });
    expect(screen.getByText('Back')).toHaveStyle({ color: L.text });
  });

  it('danger fills with danger and white text', async () => {
    await render(<Button testID="b" variant="danger">Delete</Button>);
    expect(screen.getByTestId('b')).toHaveStyle({ backgroundColor: L.danger });
    expect(screen.getByText('Delete')).toHaveStyle({ color: L.onColor });
  });

  it('quiet is transparent with text2', async () => {
    await render(<Button testID="b" variant="quiet">Skip</Button>);
    expect(screen.getByTestId('b')).toHaveStyle({ backgroundColor: 'transparent' });
    expect(screen.getByText('Skip')).toHaveStyle({ color: L.text2 });
  });

  it('legacy green renders as primary: the accent never fills a button', async () => {
    await render(<Button testID="b" variant="green">Done</Button>);
    expect(screen.getByTestId('b')).toHaveStyle({ backgroundColor: L.ink });
  });

  it('legacy ghost renders as quiet', async () => {
    await render(<Button testID="b" variant="ghost">Skip</Button>);
    expect(screen.getByTestId('b')).toHaveStyle({ backgroundColor: 'transparent' });
    expect(screen.getByText('Skip')).toHaveStyle({ color: L.text2 });
  });

  it('full stretches the pressable to 100% width', async () => {
    await render(<Button full onPress={jest.fn()}>Wide</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ width: '100%' });
  });

  it('applies the caller style to the pressable', async () => {
    await render(<Button style={{ flex: 2 }}>Go</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ flex: 2 });
  });

  it('draws leading and trailing icons', async () => {
    await render(<Button icon="plus" trailingIcon="arrowRight" testID="b">Add</Button>);
    expect(screen.getByTestId('b-icon')).toBeTruthy();
    expect(screen.getByTestId('b-trailing-icon')).toBeTruthy();
  });

  it('draws no icons without them', async () => {
    await render(<Button testID="b">Add</Button>);
    expect(screen.queryByTestId('b-icon')).toBeNull();
    expect(screen.queryByTestId('b-trailing-icon')).toBeNull();
  });

  it('accepts a node as children', async () => {
    await render(<Button><Text>One</Text><Text>Two</Text></Button>);
    expect(screen.getByText('One')).toBeTruthy();
    expect(screen.getByText('Two')).toBeTruthy();
  });
});

describe('Button: behaviour', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button onPress={onPress}>Go</Button>);
    await fireEvent.press(screen.getByText('Go'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled dims to 0.4 and does not press', async () => {
    const onPress = jest.fn();
    await render(<Button testID="b" disabled onPress={onPress}>Go</Button>);
    expect(screen.getByTestId('b')).toHaveStyle({ opacity: 0.4 });
    await fireEvent.press(screen.getByText('Go'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('enabled is fully opaque', async () => {
    await render(<Button testID="b">Go</Button>);
    expect(screen.getByTestId('b')).toHaveStyle({ opacity: 1 });
  });

  it('press scales to 0.97 over 120ms and springs back', async () => {
    await render(<Button>Go</Button>);
    await fireEvent(screen.getByRole('button'), 'pressIn');
    expect(R.withTiming).toHaveBeenLastCalledWith(0.97, expect.objectContaining({ duration: 120 }));
    await fireEvent(screen.getByRole('button'), 'pressOut');
    expect(R.withTiming).toHaveBeenLastCalledWith(1, expect.objectContaining({ duration: 120 }));
  });

  it('under Reduce Motion the press scale is 1', async () => {
    R.useReducedMotion.mockReturnValue(true);
    await render(<Button>Go</Button>);
    await fireEvent(screen.getByRole('button'), 'pressIn');
    expect(R.withTiming).toHaveBeenLastCalledWith(1, expect.objectContaining({ duration: 120 }));
  });

  it('a disabled button does not scale on press', async () => {
    await render(<Button disabled>Go</Button>);
    await fireEvent(screen.getByRole('button'), 'pressIn');
    expect(R.withTiming).not.toHaveBeenCalled();
  });
});
