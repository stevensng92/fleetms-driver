import * as Sentry from '@sentry/react-native';
import { jobStatus, resetUnknownReported } from '../jobStatus';

// The one rule for a job status: words, pill look, open or finished, the
// action a driver may take, and which screen the job opens on. See
// GLOSSARY.md (Job status, Open job, Finished job, Unknown status).

const capture = Sentry.captureMessage as jest.Mock;

beforeEach(() => {
  capture.mockClear();
  resetUnknownReported();
});

describe('jobStatus: the six known statuses', () => {
  it.each([
    // status        label          tone       icon            phase       action          screen
    ['pending',     'Pending',     'amber',   'clock',        'open',     'acceptReject', 'job'],
    ['confirmed',   'Confirmed',   'green',   'circleCheck',  'open',     'onMyWay',      'job'],
    ['in_progress', 'In Progress', 'blue',    'navigation',   'open',     'openTrip',     'trip'],
    ['done',        'Done',        'neutral', 'check',        'finished', 'backToJobs',   'job'],
    ['rejected',    'Rejected',    'neutral', 'ban',          'finished', 'backToJobs',   'job'],
    ['cancelled',   'Cancelled',   'neutral', 'ban',          'finished', 'backToJobs',   'job'],
  ] as const)('%s reads "%s"', (status, label, tone, icon, phase, action, screen) => {
    const s = jobStatus(status);
    expect(s.pill).toMatchObject({ label, tone, icon });
    expect(s.phase).toBe(phase);
    expect(s.action).toBe(action);
    expect(s.screen).toBe(screen);
    expect(s.unknown).toBe(false);
  });

  it('Done is ticked, not struck', () => {
    expect(jobStatus('done').pill).toMatchObject({ done: true });
    expect(jobStatus('done').pill.struck).toBeUndefined();
  });

  it('Rejected looks like Cancelled but keeps its own word', () => {
    const { label: rLabel, ...rLook } = jobStatus('rejected').pill;
    const { label: cLabel, ...cLook } = jobStatus('cancelled').pill;
    expect(rLook).toEqual(cLook);
    expect(rLook).toMatchObject({ struck: true });
    expect([rLabel, cLabel]).toEqual(['Rejected', 'Cancelled']);
  });

  it('only In Progress is live (the dark card and the glow)', () => {
    expect(jobStatus('in_progress').live).toBe(true);
    for (const s of ['pending', 'confirmed', 'done', 'rejected', 'cancelled', 'on_hold']) {
      expect(jobStatus(s).live).toBe(false);
    }
  });

  it('never says Voided', () => {
    for (const s of ['pending', 'confirmed', 'in_progress', 'done', 'rejected', 'cancelled', 'on_hold']) {
      expect(jobStatus(s).pill.label).not.toBe('Voided');
    }
  });

  it('known statuses are not reported to Sentry', () => {
    for (const s of ['pending', 'confirmed', 'in_progress', 'done', 'rejected', 'cancelled']) jobStatus(s);
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('jobStatus: reading the input', () => {
  it.each(['In Progress', 'in-progress', 'IN_PROGRESS', ' in progress '])('reads %p as in_progress', (raw) => {
    const s = jobStatus(raw);
    expect(s.pill.label).toBe('In Progress');
    expect(s.screen).toBe('trip');
    expect(s.unknown).toBe(false);
  });
});

describe('jobStatus: an unknown status', () => {
  it('shows the dispatcher\'s own word, counts as open, offers only Back to jobs', () => {
    const s = jobStatus('on_hold');
    expect(s.unknown).toBe(true);
    expect(s.pill).toEqual({ tone: 'neutral', label: 'On hold', icon: null });
    expect(s.phase).toBe('open');
    expect(s.action).toBe('backToJobs');
    expect(s.screen).toBe('job');
  });

  it('is reported to Sentry, once per word', () => {
    jobStatus('on_hold');
    jobStatus('on_hold');
    jobStatus('ON HOLD');
    jobStatus('paused');
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenCalledWith('Unknown job_status: on_hold', 'warning');
    expect(capture).toHaveBeenCalledWith('Unknown job_status: paused', 'warning');
  });

  it('"unassigned" never belongs on a driver\'s job, so it is unknown too', () => {
    expect(jobStatus('unassigned').unknown).toBe(true);
  });

  it('an empty status reads as unknown without crashing', () => {
    const s = jobStatus('');
    expect(s.unknown).toBe(true);
    expect(s.pill.label).toBe('Unknown');
  });
});
