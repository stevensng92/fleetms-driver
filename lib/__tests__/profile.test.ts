import { availabilityPill, initials } from '../profile';

// Change 26. Cases ported from the mock's rules.test.ts (availabilityPill and
// initials), on the real field names (isActive, availability).
describe('availabilityPill', () => {
  it('never shows a green pill for an inactive driver', () => {
    for (const availability of ['available', 'on_job', 'pending_confirmation', 'unavailable'] as const) {
      expect(availabilityPill({ isActive: false, availability })).toEqual({ label: 'Inactive', tone: 'neutral' });
    }
  });
  it('words each availability of an active driver', () => {
    expect(availabilityPill({ isActive: true, availability: 'available' })).toEqual({ label: 'Available', tone: 'green' });
    expect(availabilityPill({ isActive: true, availability: 'on_job' })).toEqual({ label: 'On shift', tone: 'green' });
    expect(availabilityPill({ isActive: true, availability: 'pending_confirmation' })).toEqual({ label: 'Pending confirmation', tone: 'amber' });
    expect(availabilityPill({ isActive: true, availability: 'unavailable' })).toEqual({ label: 'Off duty', tone: 'neutral' });
  });
  it('reads an availability it does not know as off duty, never green', () => {
    expect(availabilityPill({ isActive: true, availability: 'something_new' as never })).toEqual({ label: 'Off duty', tone: 'neutral' });
  });
});

describe('initials', () => {
  it('skips "bin" and "binti"', () => {
    expect(initials('Azman bin Yusof')).toBe('AY');
    expect(initials('Nur Aina binti Ali')).toBe('NA');
  });
  it('skips "bt" and "b." in any case', () => {
    expect(initials('Siti BT Hassan')).toBe('SH');
    expect(initials('Ali B. Ahmad')).toBe('AA');
  });
  it('takes the first two words otherwise', () => {
    expect(initials('Lim Wei Jie')).toBe('LW');
    expect(initials('Kumar')).toBe('K');
  });
  it('copes with extra spaces and an empty name', () => {
    expect(initials('  Lim   Wei ')).toBe('LW');
    expect(initials('')).toBe('');
  });
});
