// The one place an error becomes words a driver sees. Real error shapes only:
// a PostgREST error object, a thrown fetch TypeError, a plain Error, a string,
// null and undefined. The five sentences are pinned word for word, so a
// rewording is a deliberate test change.
import * as Sentry from '@sentry/react-native';
import { errorKind, errorWords, resetErrorWordsReported } from '../errorWords';

const capture = Sentry.captureException as jest.Mock;

const OFFLINE = 'No signal. Check your connection and try again.';
const SIGNED_OUT = "You've been signed out. Please sign in again.";
const JOB_CHANGED = "Dispatch has changed this job. It's been updated on your screen.";
const NOT_ALLOWED = "This isn't available to you. Call dispatch if you think it should be.";
const OTHER = 'Something went wrong. Try again, or call dispatch if it keeps happening.';

// What supabase-js hands back from an rpc call.
const pg = (message: string, code = 'P0001', extra: object = {}) => ({ message, code, details: null, hint: null, ...extra });

beforeEach(() => { capture.mockClear(); resetErrorWordsReported(); });

describe('no signal', () => {
  it.each([
    ['a thrown fetch failure', new TypeError('Network request failed')],
    ['a browser fetch failure', new TypeError('Failed to fetch')],
    ['an error object with status 0', { message: 'TypeError: Network request failed', code: '', status: 0 }],
    ['an aborted request', Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })],
    ['a timeout', Object.assign(new Error('timed out'), { name: 'TimeoutError' })],
  ])('%s', (_n, e) => {
    expect(errorKind(e)).toBe('offline');
    expect(errorWords(e)).toBe(OFFLINE);
  });
});

describe('signed out', () => {
  it.each([
    ['HTTP 401', { message: 'x', code: '', status: 401 }],
    ['an expired token', pg('JWT expired', 'PGRST301')],
    ['expired wording alone', new Error('JWT expired')],
    ['PGRST303', pg('JWT issued at future', 'PGRST303')],
    ['a missing refresh token', new Error('Invalid Refresh Token: Refresh Token Not Found')],
  ])('%s', (_n, e) => {
    expect(errorKind(e)).toBe('signedOut');
    expect(errorWords(e)).toBe(SIGNED_OUT);
  });
});

describe('not allowed', () => {
  it.each([
    ['HTTP 403', { message: 'x', code: '', status: 403 }],
    ['a row-level security refusal', pg('new row violates row-level security policy for table "expenses"', '42501')],
    ['server wording: Not authorized', pg('Not authorized')],
    ['server wording: Not an active driver', pg('Not an active driver')],
  ])('%s', (_n, e) => {
    expect(errorKind(e)).toBe('notAllowed');
    expect(errorWords(e)).toBe(NOT_ALLOWED);
  });
});

describe('dispatch changed the job', () => {
  it.each([
    'Cannot start a pending job (must be confirmed)',
    'Cannot confirm a cancelled assignment',
    'Cannot reject an accepted assignment',
    'Cannot complete a done job',
    'Cannot start a brand_new_status job', // a status word the app has not met still matches
    'Assignment not found or no longer current',
    'No current assignment for job',
    'No current assignment for job: it was reassigned',
  ])('%s', (message) => {
    expect(errorKind(pg(message))).toBe('jobChanged');
    expect(errorWords(pg(message))).toBe(JOB_CHANGED);
  });
});

describe('anything else', () => {
  it.each([
    ['an unknown server rule', pg('amount_rm must be positive', '23514')],
    ['a plain Error', new Error('boom')],
    ['a string', 'boom'],
    ['null', null],
    ['undefined', undefined],
    ['an object with no message', {}],
  ])('%s', (_n, e) => {
    expect(errorKind(e)).toBe('other');
    expect(errorWords(e)).toBe(OTHER);
  });

  it('never shows the raw text', () => {
    expect(errorWords(pg('amount_rm must be positive', '23514'))).not.toMatch(/amount_rm/);
  });
});

describe('order of checks', () => {
  it('offline beats signed out', () => {
    expect(errorKind({ message: 'JWT expired', status: 0 })).toBe('offline');
  });
  it('signed out beats not allowed', () => {
    expect(errorKind({ message: 'Not authorized', status: 401 })).toBe('signedOut');
  });
  it('not allowed beats job changed', () => {
    expect(errorKind({ message: 'Cannot start a pending job', code: '42501' })).toBe('notAllowed');
  });
});

describe('Sentry', () => {
  it('gets the raw error', () => {
    const e = pg('Not authorized');
    errorWords(e);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0][0]).toBe(e);
  });

  it('hears about a kind once per app run, not on every retry', () => {
    errorWords(new TypeError('Network request failed'));
    errorWords(new TypeError('Network request failed'));
    errorWords(new TypeError('Failed to fetch'));
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('hears about each kind separately', () => {
    errorWords(new TypeError('Network request failed'));
    errorWords(pg('Not authorized'));
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it('hears about each new wording of "other", so a new server rule surfaces', () => {
    errorWords(pg('amount_rm must be positive'));
    errorWords(pg('amount_rm must be positive'));
    errorWords(pg('end_date before start_date'));
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it('hears about each new wording of "jobChanged"', () => {
    errorWords(pg('Cannot start a pending job'));
    errorWords(pg('Cannot start a done job'));
    errorWords(pg('Cannot start a done job'));
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it('does not break the sentence when Sentry throws', () => {
    capture.mockImplementationOnce(() => { throw new Error('sentry down'); });
    expect(errorWords(new Error('boom'))).toBe(OTHER);
  });
});
