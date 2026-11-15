import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TabBar, renderTabBar } from '../TabBar';

const mk = (over: Record<string, unknown> = {}) => ([
  { key: 'jobs', label: 'Jobs', icon: 'home' as const, active: true, onPress: jest.fn() },
  { key: 'expenses', label: 'Expenses', icon: 'receipt' as const, active: false, onPress: jest.fn() },
  { key: 'earnings', label: 'Earnings', icon: 'wallet' as const, active: false, onPress: jest.fn() },
  { key: 'profile', label: 'Profile', icon: 'user' as const, active: false, onPress: jest.fn(), ...over },
]);

describe('TabBar', () => {
  it('shows the word only on the active tab', async () => {
    await render(<TabBar tabs={mk()}/>);
    expect(screen.getByText('Jobs')).toBeTruthy();
    expect(screen.queryByText('Expenses')).toBeNull();
  });

  it('every tab keeps an accessibility label and selected state', async () => {
    await render(<TabBar tabs={mk()}/>);
    expect(screen.getByLabelText('Jobs').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Expenses').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('pressing a tab calls its onPress', async () => {
    const tabs = mk();
    await render(<TabBar tabs={tabs}/>);
    await fireEvent.press(screen.getByLabelText('Earnings'));
    expect(tabs[2].onPress).toHaveBeenCalledTimes(1);
  });

  it('a badge shows a dot and adds to the label', async () => {
    await render(<TabBar tabs={mk({ badge: true })}/>);
    expect(screen.getByTestId('tab-badge-profile')).toBeTruthy();
    expect(screen.getByLabelText('Profile, update available')).toBeTruthy();
  });

  it('draws no dot without a badge', async () => {
    await render(<TabBar tabs={mk()}/>);
    expect(screen.queryByTestId('tab-badge-profile')).toBeNull();
  });
});

describe('renderTabBar', () => {
  const config = {
    index: { label: 'Jobs', icon: 'home' as const },
    profile: { label: 'Profile', icon: 'user' as const, badge: true },
  };
  const make = (index: number) => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const navigate = jest.fn();
    const props = {
      state: { index, routes: [{ key: 'index-1', name: 'index' }, { key: 'profile-1', name: 'profile' }, { key: 'hidden-1', name: 'unlisted' }] },
      navigation: { emit, navigate },
    } as never;
    return { props, emit, navigate };
  };

  it('maps routes to tabs, skips unlisted routes, marks the focused one', async () => {
    const { props } = make(0);
    await render(<>{renderTabBar(props, config)}</>);
    expect(screen.getByText('Jobs')).toBeTruthy();
    expect(screen.queryByText('Profile')).toBeNull();
    expect(screen.getByTestId('tab-badge-profile')).toBeTruthy();
    expect(screen.queryByLabelText('unlisted')).toBeNull();
  });

  it('pressing another tab emits tabPress and navigates', async () => {
    const { props, emit, navigate } = make(0);
    await render(<>{renderTabBar(props, config)}</>);
    await fireEvent.press(screen.getByLabelText('Profile, update available'));
    expect(emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'profile-1', canPreventDefault: true });
    expect(navigate).toHaveBeenCalledWith('profile');
  });

  it('pressing the focused tab does not navigate', async () => {
    const { props, navigate } = make(0);
    await render(<>{renderTabBar(props, config)}</>);
    await fireEvent.press(screen.getByLabelText('Jobs'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not navigate when a listener prevents the press', async () => {
    const { props, emit, navigate } = make(0);
    emit.mockReturnValue({ defaultPrevented: true });
    await render(<>{renderTabBar(props, config)}</>);
    await fireEvent.press(screen.getByLabelText('Profile, update available'));
    expect(navigate).not.toHaveBeenCalled();
  });
});
