import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Icon, IconName, ICON_NAMES } from '../Icon';

const OLD: IconName[] = [
  'home', 'receipt', 'wallet', 'user', 'chevL', 'chevR', 'chevDown', 'check', 'checkCirc', 'x',
  'pin', 'clock', 'phone', 'car', 'users', 'fuel', 'toll', 'dots', 'camera', 'calendar', 'waze',
  'maps', 'bell', 'plus', 'image', 'zoom', 'arrowRight',
];
const NEW: IconName[] = [
  'navigation', 'ban', 'hourglass', 'badgeCheck', 'circleX', 'circleAlert', 'triangleAlert', 'info',
  'logOut', 'calendarDays', 'chevUp', 'circleCheck', 'circleMinus', 'undo2', 'download',
  'circleArrowUp', 'imagePlus', 'ticket',
];

describe('Icon', () => {
  it('keeps all 27 existing names and adds the new ones', () => {
    expect(OLD).toHaveLength(27);
    for (const n of [...OLD, ...NEW]) expect(ICON_NAMES).toContain(n);
  });

  it.each([...OLD, ...NEW])('draws %s', async (name) => {
    await render(<Icon name={name} testID="icon"/>);
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('draws nothing for an unknown name', async () => {
    await render(<Icon name={'nope' as IconName} testID="icon"/>);
    expect(screen.queryByTestId('icon')).toBeNull();
  });
});
