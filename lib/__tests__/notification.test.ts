import * as Sentry from '@sentry/react-native';
import { readNotification, readPushTap, sentAt, resetNotificationReported } from '../notification';

const capture = Sentry.captureMessage as jest.Mock;

// 2026-12-12 01:22 UTC is 09:22 in Malaysia.
const WHEN = '2026-12-12T01:22:00Z';

beforeEach(() => {
  capture.mockClear();
  resetNotificationReported();
});

describe('a Notifications screen row', () => {
  it('keeps the job number apart from the title', () => {
    const t = readNotification('job_assigned', { job_number: 'JOB-047', client_name: 'Acme', pickup_location: 'KLIA', pickup_datetime: WHEN });
    expect(t.title).toBe('New job');
    expect(t.jobNumber).toBe('JOB-047');
    expect(t.body).toBe('Acme, KLIA, 12 Dec, 09:22');
  });
  it('writes no middle dots anywhere', () => {
    for (const kind of ['job_assigned', 'pickup_reminder', 'job_updated', 'job_cancelled', 'reassigned']) {
      const t = readNotification(kind, { job_number: 'JOB-1', client_name: 'A', pickup_location: 'B', pickup_datetime: WHEN });
      expect(`${t.title}${t.body}`).not.toContain('·');
    }
  });
  it('leaves out parts the data does not have', () => {
    expect(readNotification('job_assigned', { job_number: 'JOB-1', pickup_location: 'KLIA' }).body).toBe('KLIA');
    expect(readNotification('job_assigned', { job_number: 'JOB-1' }).body).toBe('');
  });
  it('words each type', () => {
    const p = { job_number: 'JOB-2', pickup_location: 'Sentral', pickup_datetime: WHEN };
    expect(readNotification('pickup_reminder', p)).toEqual({ title: 'Pickup soon', jobNumber: 'JOB-2', body: 'Sentral, 12 Dec, 09:22', link: null });
    expect(readNotification('job_updated', p)).toEqual({ title: 'Job updated', jobNumber: 'JOB-2', body: 'Sentral, 12 Dec, 09:22', link: null });
    expect(readNotification('job_cancelled', p)).toEqual({ title: 'Job cancelled', jobNumber: 'JOB-2', body: 'Sentral', link: null });
    expect(readNotification('reassigned', p)).toEqual({ title: 'Reassigned', jobNumber: 'JOB-2', body: 'Sentral', link: null });
  });
  it('has no job number when the data has none', () => {
    expect(readNotification('job_cancelled', {}).jobNumber).toBeNull();
    expect(readNotification('job_cancelled', null)).toEqual({ title: 'Job cancelled', jobNumber: null, body: '', link: null });
  });
  it('known types are not reported to Sentry', () => {
    readNotification('job_assigned', { job_number: 'JOB-1', deeplink: '/jobs/JOB-1' });
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('an unknown notification type', () => {
  it('is titled with its own name, in words', () => {
    expect(readNotification('shift_note', {}).title).toBe('shift note');
  });
  it('shows the pickup place and time in plain words, never raw data', () => {
    const t = readNotification('shift_note', { job_number: 'JOB-9', pickup_location: 'KLIA', pickup_datetime: WHEN, secret: 'x' });
    expect(t.jobNumber).toBe('JOB-9');
    expect(t.body).toBe('KLIA, 12 Dec, 09:22');
  });
  it('shows nothing when there are no job details', () => {
    expect(readNotification('shift_note', { a: 1 }).body).toBe('');
  });
  it('is reported to Sentry, once per type', () => {
    readNotification('shift_note', {});
    readNotification('shift_note', {});
    readNotification('fuel_note', {});
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenCalledWith('Unknown notification type: shift_note', 'warning');
  });
});

describe('the link a row opens', () => {
  const link = (deeplink: unknown) => readNotification('job_assigned', { deeplink }).link;

  it('opens the screens a notification may lead to', () => {
    expect(link('/jobs/JOB-047')).toBe('/jobs/JOB-047');
    expect(link('/(tabs)')).toBe('/(tabs)');
    expect(link('/notifications')).toBe('/notifications');
    expect(link('/profile/time-off')).toBe('/profile/time-off');
  });
  it('is none when there is no link', () => {
    expect(link(null)).toBeNull();
    expect(link(undefined)).toBeNull();
    expect(link('')).toBeNull();
    expect(link(42)).toBeNull();
  });
  it('refuses anything that only starts like an allowed link', () => {
    for (const bad of [
      '/(tabs)/../admin',
      '/(tabs)evil',
      '/jobs/',
      '/jobs/JOB-1/edit',
      '/jobs/..',
      '/jobs/.',
      '/jobs/JOB-1?x=1',
      '/jobs/JOB-1#top',
      '/notifications/old',
      '/profile/time-off/2',
      '/profile/other',
      '/admin/secret',
      'https://example.com',
      '//example.com/jobs/JOB-1',
      'jobs/JOB-1',
    ]) {
      expect([bad, link(bad)]).toEqual([bad, null]);
    }
  });
  it('reports a refused link to Sentry once per link, and a missing one never', () => {
    link('/admin/secret');
    link('/admin/secret');
    link('/other');
    link(null);
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenCalledWith('Refused notification link: /admin/secret', 'warning');
  });
});

describe('a push tap', () => {
  it('opens the allowed link and names its row', () => {
    expect(readPushTap({ deeplink: '/jobs/JOB-047', push_log_id: 'row-1' })).toEqual({ link: '/jobs/JOB-047', rowId: 'row-1' });
  });
  it('opens the Notifications screen when the link is refused', () => {
    expect(readPushTap({ deeplink: '/admin/secret', push_log_id: 'row-1' })).toEqual({ link: '/notifications', rowId: 'row-1' });
  });
  it('opens the Notifications screen when there is no link', () => {
    expect(readPushTap({ push_log_id: 'row-1' })).toEqual({ link: '/notifications', rowId: 'row-1' });
  });
  it('names no row when the push carries none', () => {
    expect(readPushTap({ deeplink: '/(tabs)' })).toEqual({ link: '/(tabs)', rowId: null });
    expect(readPushTap(null)).toEqual({ link: '/notifications', rowId: null });
    expect(readPushTap({ push_log_id: 7 })).toEqual({ link: '/notifications', rowId: null });
  });
});

describe('sentAt', () => {
  it('reads like "12 Dec, 09:22"', () => {
    expect(sentAt(WHEN)).toBe('12 Dec, 09:22');
  });
});

describe('the Time format setting', () => {
  it('writes the pickup time in the style it is given', () => {
    const p = { job_number: 'JOB-2', pickup_location: 'Sentral', pickup_datetime: WHEN };
    expect(readNotification('pickup_reminder', p, '12h').body).toBe('Sentral, 12 Dec, 9:22 am');
    expect(readNotification('pickup_reminder', p, '24h').body).toBe('Sentral, 12 Dec, 09:22');
  });
  it('writes the sent time in the style it is given', () => {
    expect(sentAt(WHEN, '12h')).toBe('12 Dec, 9:22 am');
    expect(sentAt(WHEN)).toBe('12 Dec, 09:22');
  });
});
