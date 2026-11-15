// The entrance shared by Sheet, ConfirmDialog and Toast. Pure, so the Reduce
// Motion rule is testable without a native runtime. It runs inside reanimated
// worklets, hence the directive. Rule (design.md): only opacity and transform
// move, and under Reduce Motion nothing slides or scales; the fade stays.

export type EnterOptions = {
  /** The phone's Reduce Motion setting. */
  reduced: boolean;
  /** Pixels to rise from (0 = none). */
  rise?: number;
  /** Scale to grow from (1 = none). */
  scaleFrom?: number;
};

/** The look at `progress` (0 to 1) of an entrance. */
export function enterFrame(progress: number, { reduced, rise = 0, scaleFrom = 1 }: EnterOptions) {
  'worklet';
  const left = 1 - progress;
  return {
    opacity: progress,
    translateY: reduced ? 0 : left * rise,
    scale: reduced ? 1 : 1 - left * (1 - scaleFrom),
  };
}
