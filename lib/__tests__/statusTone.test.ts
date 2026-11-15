import { statusTone } from '../statusTone';

describe('statusTone: job', () => {
  it.each([
    ['pending', 'amber', 'Pending', 'clock'],
    ['confirmed', 'green', 'Confirmed', 'circleCheck'],
    ['in_progress', 'blue', 'In Progress', 'navigation'],
  ] as const)('%s -> %s "%s"', (status, tone, label, icon) => {
    expect(statusTone('job', status)).toEqual({ tone, label, icon });
  });

  it('done is neutral and flagged done', () => {
    expect(statusTone('job', 'done')).toEqual({ tone: 'neutral', label: 'Done', icon: 'check', done: true });
  });

  it('cancelled is neutral and struck through (never red)', () => {
    expect(statusTone('job', 'cancelled')).toEqual({ tone: 'neutral', label: 'Cancelled', icon: 'ban', struck: true });
  });

  it.each(['In Progress', 'in-progress', 'IN_PROGRESS', ' in progress '])('normalises %p to in_progress', (raw) => {
    expect(statusTone('job', raw).label).toBe('In Progress');
    expect(statusTone('job', raw).tone).toBe('blue');
  });

  it('an unknown status is neutral and shows the raw word, with no icon', () => {
    expect(statusTone('job', 'Weird')).toEqual({ tone: 'neutral', label: 'Weird', icon: null });
  });
});

describe('statusTone: payment', () => {
  it.each([
    ['paid', 'green', 'Paid', 'badgeCheck'],
    ['unpaid', 'amber', 'Unpaid', 'hourglass'],
    ['waived', 'neutral', 'Waived', 'circleMinus'],
    ['refunded', 'red', 'Refunded', 'undo2'],
  ] as const)('%s -> %s "%s"', (status, tone, label, icon) => {
    expect(statusTone('payment', status)).toEqual({ tone, label, icon });
  });

  it('has no Invoiced state: it falls back to neutral with the raw word', () => {
    expect(statusTone('payment', 'invoiced')).toEqual({ tone: 'neutral', label: 'invoiced', icon: null });
  });

  it('keeps the two vocabularies apart', () => {
    // "paid" is a payment word, not a job word.
    expect(statusTone('job', 'paid').tone).toBe('neutral');
    expect(statusTone('payment', 'pending').tone).toBe('neutral');
  });
});
