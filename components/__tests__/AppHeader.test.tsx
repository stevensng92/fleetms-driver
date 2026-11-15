import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AppHeader, SectionLabel } from '../AppHeader';

describe('AppHeader', () => {
  it('shows title and subtitle, no back button by default', async () => {
    await render(<AppHeader title="Earnings" subtitle="This week"/>);
    expect(screen.getByText('Earnings')).toBeTruthy();
    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('omits the subtitle when none is given', async () => {
    await render(<AppHeader title="Jobs"/>);
    expect(screen.queryByText('This week')).toBeNull();
  });

  it('back button calls onBack', async () => {
    const onBack = jest.fn();
    await render(<AppHeader title="Job" onBack={onBack}/>);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('title is 28px bold; back target is 44px', async () => {
    await render(<AppHeader title="Job" onBack={jest.fn()}/>);
    expect(screen.getByText('Job')).toHaveStyle({ fontSize: 28, fontWeight: '700' });
    expect(screen.getByLabelText('Back')).toHaveStyle({ width: 44, height: 44 });
  });

  it('renders the right slot', async () => {
    await render(<AppHeader title="Job" right={<Text>Edit</Text>}/>);
    expect(screen.getByText('Edit')).toBeTruthy();
  });
});

describe('SectionLabel', () => {
  it('is sentence case, 16px semibold, with a right slot', async () => {
    await render(<SectionLabel right={<Text>See all</Text>}>Driver info</SectionLabel>);
    const t = screen.getByText('Driver info');
    expect(t).toHaveStyle({ fontSize: 16, fontWeight: '600' });
    expect(StyleSheet.flatten(t.props.style).textTransform).toBeUndefined();
    expect(screen.getByText('See all')).toBeTruthy();
  });
});
