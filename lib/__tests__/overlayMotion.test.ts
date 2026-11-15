import { enterFrame } from '../overlayMotion';

// The shared entrance for Sheet, ConfirmDialog and Toast. Progress runs 0 to 1.
describe('enterFrame', () => {
  it('starts hidden and displaced, ends shown and in place', () => {
    expect(enterFrame(0, { reduced: false, rise: 40 })).toEqual({ opacity: 0, translateY: 40, scale: 1 });
    expect(enterFrame(1, { reduced: false, rise: 40 })).toEqual({ opacity: 1, translateY: 0, scale: 1 });
  });

  it('moves part of the way at half progress', () => {
    expect(enterFrame(0.5, { reduced: false, rise: 40 }).translateY).toBe(20);
  });

  it('scales up from scaleFrom to 1', () => {
    expect(enterFrame(0, { reduced: false, scaleFrom: 0.97 }).scale).toBeCloseTo(0.97);
    expect(enterFrame(1, { reduced: false, scaleFrom: 0.97 }).scale).toBe(1);
  });

  it('under Reduce Motion fades only: no rise, no scale', () => {
    expect(enterFrame(0, { reduced: true, rise: 40, scaleFrom: 0.97 })).toEqual({ opacity: 0, translateY: 0, scale: 1 });
    expect(enterFrame(0.5, { reduced: true, rise: 40, scaleFrom: 0.97 }).opacity).toBe(0.5);
  });
});
