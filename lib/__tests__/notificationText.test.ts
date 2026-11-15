import { notificationText, notificationLink, sentAt } from '../notificationText';

// 2026-12-12 01:22 UTC is 09:22 in Malaysia.
const WHEN = '2026-12-12T01:22:00Z';

describe('notificationText', () => {
  it('keeps the job number apart from the title', () => {
    const t = notificationText('job_assigned', { job_number: 'JOB-047', client_name: 'Acme', pickup_location: 'KLIA', pickup_datetime: WHEN });
    expect(t.title).toBe('New job');
    expect(t.jobNumber).toBe('JOB-047');
    expect(t.body).toBe('Acme, KLIA, 12 Dec, 09:22');
  });
  it('writes no middle dots anywhere', () => {
    for (const kind of ['job_assigned', 'pickup_reminder', 'job_updated', 'job_cancelled', 'reassigned']) {
      const t = notificationText(kind, { job_number: 'JOB-1', client_name: 'A', pickup_location: 'B', pickup_datetime: WHEN });
      expect(`${t.title}${t.body}`).not.toContain('·');
    }
  });
  it('leaves out parts the payload does not have', () => {
    expect(notificationText('job_assigned', { job_number: 'JOB-1', pickup_location: 'KLIA' }).body).toBe('KLIA');
    expect(notificationText('job_assigned', { job_number: 'JOB-1' }).body).toBe('');
  });
  it('words each kind', () => {
    const p = { job_number: 'JOB-2', pickup_location: 'Sentral', pickup_datetime: WHEN };
    expect(notificationText('pickup_reminder', p)).toEqual({ title: 'Pickup soon', jobNumber: 'JOB-2', body: 'Sentral, 12 Dec, 09:22' });
    expect(notificationText('job_updated', p)).toEqual({ title: 'Job updated', jobNumber: 'JOB-2', body: 'Sentral, 12 Dec, 09:22' });
    expect(notificationText('job_cancelled', p)).toEqual({ title: 'Job cancelled', jobNumber: 'JOB-2', body: 'Sentral' });
    expect(notificationText('reassigned', p)).toEqual({ title: 'Reassigned', jobNumber: 'JOB-2', body: 'Sentral' });
  });
  it('has no job number when the payload has none', () => {
    expect(notificationText('job_cancelled', {}).jobNumber).toBeNull();
    expect(notificationText('job_cancelled', null)).toEqual({ title: 'Job cancelled', jobNumber: null, body: '' });
  });
  it('falls back for an unknown kind', () => {
    const t = notificationText('shift_note', { a: 1 });
    expect(t.title).toBe('shift note');
    expect(t.jobNumber).toBeNull();
    expect(t.body).toBe('{"a":1}');
  });
});

describe('notificationLink', () => {
  it('lets through the routes the app has', () => {
    expect(notificationLink('/jobs/JOB-047')).toBe('/jobs/JOB-047');
    expect(notificationLink('/(tabs)')).toBe('/(tabs)');
    expect(notificationLink('/profile/time-off')).toBe('/profile/time-off');
  });
  it('drops a link that leads nowhere', () => {
    expect(notificationLink(null)).toBeNull();
    expect(notificationLink('')).toBeNull();
    expect(notificationLink('/admin/secret')).toBeNull();
    expect(notificationLink('https://example.com')).toBeNull();
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
    expect(notificationText('pickup_reminder', p, '12h').body).toBe('Sentral, 12 Dec, 9:22 am');
    expect(notificationText('pickup_reminder', p, '24h').body).toBe('Sentral, 12 Dec, 09:22');
  });
  it('writes the sent time in the style it is given', () => {
    expect(sentAt(WHEN, '12h')).toBe('12 Dec, 9:22 am');
    expect(sentAt(WHEN)).toBe('12 Dec, 09:22');
  });
});
