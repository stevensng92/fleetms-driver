// Value: protects=a fake-database test never straddles Malaysian midnight (the story's "today" and the code's "today" agree); fails_when=the guard stops waiting near midnight, or waits at other times; why_new=the story day and the code clock are read separately, so a run crossing 16:00 UTC could fail at random; seam=none; no_claim=the wait itself (a real sleep is not run here)
import { msToWaitPastMidnight, MIDNIGHT_MARGIN_MS, waitPastMidnight } from '../fakeDatabase';

// Malaysian midnight is 16:00 UTC.
const at = (iso: string) => new Date(iso);

describe('msToWaitPastMidnight', () => {
  it('does not wait in the middle of the day', () => {
    expect(msToWaitPastMidnight(at('2026-11-17T04:00:00.000Z'))).toBe(0);
  });

  it('does not wait just outside the margin', () => {
    const t = new Date(Date.parse('2026-11-17T16:00:00.000Z') - MIDNIGHT_MARGIN_MS - 1);
    expect(msToWaitPastMidnight(t)).toBe(0);
  });

  it('waits until just past midnight when a test starts inside the margin', () => {
    expect(msToWaitPastMidnight(at('2026-11-17T15:59:50.000Z'))).toBe(10_001);
  });

  it('waits just past midnight from the last millisecond of the day', () => {
    expect(msToWaitPastMidnight(at('2026-11-17T15:59:59.999Z'))).toBe(2);
  });

  it('does not wait right after midnight', () => {
    expect(msToWaitPastMidnight(at('2026-11-17T16:00:00.000Z'))).toBe(0);
  });

  it('keeps the margin short enough for a beforeEach to sit out', () => {
    expect(MIDNIGHT_MARGIN_MS).toBeLessThanOrEqual(30_000);
  });
});

// Value: protects=the helper really sleeps out the margin before it builds the story, and stays instant otherwise; fails_when=the wait is skipped, not awaited, or runs at midday; why_new=msToWaitPastMidnight only decides how long, nothing checked that the wait happens; seam=none (sleep is a parameter of a test helper, not app code); no_claim=real setTimeout timing
describe('waitPastMidnight', () => {
  it('sleeps out the margin, and only resolves after the sleep', async () => {
    const order: string[] = [];
    const sleep = jest.fn(async (ms: number) => { order.push(`slept ${ms}`); });
    await waitPastMidnight(at('2026-11-17T15:59:50.000Z'), sleep);
    order.push('done');
    expect(order).toEqual(['slept 10001', 'done']);
  });

  it('does not sleep in the middle of the day', async () => {
    const sleep = jest.fn(async () => {});
    await waitPastMidnight(at('2026-11-17T04:00:00.000Z'), sleep);
    expect(sleep).not.toHaveBeenCalled();
  });
});
