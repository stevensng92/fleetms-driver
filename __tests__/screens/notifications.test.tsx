import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { resetClockStyleForTests, setClockStyle } from '../../lib/clockPref';
import Notifications from '../../app/notifications';
import { useNotifications, useMarkNotificationsRead, type NotificationItem } from '../../lib/queries/notifications';
import { makeTokens } from '../../theme/tokens';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
// The query module builds a live Supabase client at import, so it is mocked.
jest.mock('../../lib/queries/notifications', () => ({
  useNotifications: jest.fn(),
  useMarkNotificationsRead: jest.fn(),
}));

const item = (over: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'n1',
  kind: 'job_assigned',
  enqueuedAt: '2026-12-12T01:22:00Z',
  sentAt: null,
  readAt: null,
  deeplink: '/jobs/JOB-047',
  title: 'New job',
  jobNumber: 'JOB-047',
  body: 'Acme, KLIA, 12 Dec, 09:22',
  ...over,
});

function mockList(data: NotificationItem[]) {
  (useNotifications as jest.Mock).mockReturnValue({ data, isLoading: false, error: null, refetch: jest.fn() });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useMarkNotificationsRead as jest.Mock).mockReturnValue({ mutate: jest.fn() });
});

describe('Notifications', () => {
  it('shows the title, the job number beside it, the body and the sent time', async () => {
    mockList([item()]);
    await render(<Notifications/>);
    expect(screen.getByText('New job')).toBeTruthy();
    expect(screen.getByText('JOB-047')).toBeTruthy();
    expect(screen.getByText('Acme, KLIA, 12 Dec, 09:22')).toBeTruthy();
    expect(screen.getByText('12 Dec, 09:22')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain('·');
  });

  it('marks an unread item with a New pill, not a red dot', async () => {
    mockList([item({ readAt: null })]);
    await render(<Notifications/>);
    expect(screen.getByText('New')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain(makeTokens('light').red);
  });

  it('shows no pill on a read item', async () => {
    mockList([item({ readAt: '2026-12-12T02:00:00Z' })]);
    await render(<Notifications/>);
    expect(screen.queryByText('New')).toBeNull();
  });

  it('opens the job from a row with a link', async () => {
    mockList([item()]);
    await render(<Notifications/>);
    await fireEvent.press(screen.getByText('New job'));
    expect(router.push).toHaveBeenCalledWith('/jobs/JOB-047');
  });

  it('is a button only when the link leads somewhere', async () => {
    mockList([
      item({ id: 'a', deeplink: '/jobs/JOB-047', jobNumber: 'JOB-047' }),
      item({ id: 'b', deeplink: null, jobNumber: 'JOB-048', title: 'Job cancelled', body: 'KLIA' }),
    ]);
    await render(<Notifications/>);
    // Close button plus the one linked row.
    expect(screen.getAllByRole('button')).toHaveLength(2);
    await fireEvent.press(screen.getByText('Job cancelled'));
    expect(router.push).not.toHaveBeenCalled();
  });
});

// Change 33: the sent time follows the Time format setting.
describe('Notifications with the Time format setting', () => {
  afterEach(() => resetClockStyleForTests());
  it('shows the sent time in the chosen style', async () => {
    mockList([item()]);
    await render(<Notifications/>);
    expect(screen.getByText('12 Dec, 09:22')).toBeTruthy();
    await act(async () => { setClockStyle('12h'); });
    expect(screen.getByText('12 Dec, 9:22 am')).toBeTruthy();
    expect(screen.queryByText('12 Dec, 09:22')).toBeNull();
  });
});
