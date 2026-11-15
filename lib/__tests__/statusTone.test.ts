import { paymentTone, toKey } from '../statusTone';
import { jobStatus } from '../jobStatus';

// Job statuses are tested in jobStatus.test.ts, the one place that reads them.

describe('toKey', () => {
  it.each(['In Progress', 'in-progress', 'IN_PROGRESS', ' in progress '])('normalises %p to in_progress', (raw) => {
    expect(toKey(raw)).toBe('in_progress');
  });
});

describe('paymentTone', () => {
  it.each([
    ['paid', 'green', 'Paid', 'badgeCheck'],
    ['unpaid', 'amber', 'Unpaid', 'hourglass'],
    ['waived', 'neutral', 'Waived', 'circleMinus'],
    ['refunded', 'red', 'Refunded', 'undo2'],
  ] as const)('%s -> %s "%s"', (status, tone, label, icon) => {
    expect(paymentTone(status)).toEqual({ tone, label, icon });
  });

  it('has no Invoiced state: it falls back to neutral with the raw word', () => {
    expect(paymentTone('invoiced')).toEqual({ tone: 'neutral', label: 'invoiced', icon: null });
  });

  it('keeps the job and payment vocabularies apart', () => {
    // "paid" is a payment word, not a job word, and "pending" the other way round.
    expect(jobStatus('paid').unknown).toBe(true);
    expect(paymentTone('pending').tone).toBe('neutral');
  });
});
