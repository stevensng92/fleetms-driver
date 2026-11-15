// FleetMS Driver: theme tokens.
//
// Ported from the redesign's token file, design-systems/fleetms/colors_and_type.css
// (docs/redesign-plan.md, phase 1a). Three surface layers (ground, well, surface),
// one ink, one green-to-lime accent, and a dark "feature" card that stays dark in
// both themes. Screens read colours only through useTokens(); nothing else holds
// a colour.
//
// Three things React Native can't read from the CSS, converted once here:
// - The blues are oklch in the CSS. Converted to hex (the original in a comment).
// - The scrim is a color-mix; it is a plain rgba here.
// - The accent is a gradient. Its two ends are goFrom/goTo; a small SVG piece
//   (GoFill, phase 1b) draws it.
//
// The OLD names (primary, accent, muted, heroBg...) are kept as aliases onto the
// new palette, so every screen repaints without being touched. Phase 1d removes
// them once the screens read the new names.

export type ThemeMode = 'light' | 'dark';

type Palette = {
  // Surfaces
  ground: string; well: string; surface: string; surfaceSunk: string; track: string;
  controlRing: string; thumb: string;
  ink: string; ink2: string;
  // The dark card: dark in both themes
  feature: string; onFeature: string; onFeature2: string; featureTrack: string; featureEdge: string;
  // Text
  text: string; text2: string; text3: string; onInk: string; onInk2: string; onColor: string;
  // Lines
  hairline: string; hairlineStrong: string;
  // Accent: green running into lime. Text on it is always dark.
  go: string; goLime: string; goFrom: string; goTo: string; goSoftFrom: string; goSoftTo: string;
  goText: string; onGo: string;
  // Status hues: hue, soft tint, readable text
  green: string; greenSoft: string; greenText: string;
  amber: string; amberSoft: string; amberText: string;
  blue: string; blueSoft: string; blueText: string;
  red: string; redSoft: string; redText: string;
  neutral: string; neutralSoft: string; neutralText: string;
  danger: string; dangerHover: string;
  // Overlays and depth
  scrim: string; shadow1: string; shadow2: string; thumbShadow: string;
  // Receipt paper (the receipt viewer's stand-in sheet). Not in the mock; kept.
  paper: string; paperInk: string;
};

/** The status tints a pill uses on the dark feature card, in BOTH themes (change 34). */
export type FeatureStatus = Pick<Palette,
  'greenSoft' | 'greenText' | 'amberSoft' | 'amberText' | 'blueSoft' | 'blueText' |
  'redSoft' | 'redText' | 'neutralSoft' | 'neutralText'>;

const LIGHT: Palette = {
  ground: '#F6F6F7', well: '#EDEDEF', surface: '#FFFFFF', surfaceSunk: '#F2F2F4', track: '#E3E3E6',
  controlRing: '#8E8E98', thumb: '#FFFFFF',
  ink: '#131316', ink2: '#232328',
  feature: '#131316', onFeature: '#FFFFFF', onFeature2: '#9C9CA5',
  featureTrack: 'rgba(255,255,255,0.12)', featureEdge: 'transparent',
  text: '#131316', text2: '#55555E', text3: '#6B6B74', onInk: '#FFFFFF', onInk2: '#A4A4AD', onColor: '#FFFFFF',
  hairline: 'rgba(19,19,22,0.07)', hairlineStrong: 'rgba(19,19,22,0.12)',
  go: '#22C55E', goLime: '#B5F23D', goFrom: '#2BD45F', goTo: '#B5F23D', goSoftFrom: '#DDF8E2', goSoftTo: '#EEFBD2',
  goText: '#0E7A35', onGo: '#0C2A16',
  green: '#22C55E', greenSoft: '#DDF8E2', greenText: '#0E7A35',
  amber: '#F5A524', amberSoft: '#FEF1D8', amberText: '#8A5300',
  blue: '#008FD6', // oklch(62% 0.15 240)
  blueSoft: '#DDF0FE', // oklch(94.5% 0.028 240)
  blueText: '#005EA2', // oklch(47% 0.135 248)
  red: '#EF4444', redSoft: '#FDE3E3', redText: '#B42318',
  neutral: '#8E8E98', neutralSoft: '#E9E9EC', neutralText: '#4A4A52',
  danger: '#DC2626', dangerHover: '#B91C1C',
  scrim: 'rgba(19,19,22,0.42)', // the feature colour at 42%
  shadow1: '0px 1px 2px rgba(19,19,22,0.04), 0px 6px 20px -8px rgba(19,19,22,0.10)',
  shadow2: '0px 2px 4px rgba(19,19,22,0.05), 0px 18px 40px -12px rgba(19,19,22,0.18)',
  thumbShadow: '0px 1px 3px rgba(19,19,22,0.18), 0px 4px 10px -2px rgba(19,19,22,0.16)',
  paper: '#FBF8F1', paperInk: '#3F2A1A',
};

const DARK: Palette = {
  ground: '#0B0B0D', well: '#151518', surface: '#202024', surfaceSunk: '#17171A', track: '#2A2A2F',
  controlRing: '#6E6E78', thumb: '#FFFFFF',
  ink: '#F4F4F5', ink2: '#E4E4E7',
  feature: '#000000', onFeature: '#FFFFFF', onFeature2: '#8E8E98',
  featureTrack: 'rgba(255,255,255,0.12)', featureEdge: 'rgba(255,255,255,0.08)',
  text: '#F4F4F5', text2: '#A4A4AD', text3: '#8E8E98', onInk: '#131316', onInk2: '#62626B', onColor: '#FFFFFF',
  hairline: 'rgba(255,255,255,0.08)', hairlineStrong: 'rgba(255,255,255,0.14)',
  go: '#22C55E', goLime: '#B5F23D', goFrom: '#2BD45F', goTo: '#B5F23D',
  goSoftFrom: 'rgba(43,212,95,0.18)', goSoftTo: 'rgba(181,242,61,0.12)',
  goText: '#4ADE80', onGo: '#0C2A16',
  green: '#22C55E', greenSoft: 'rgba(34,197,94,0.18)', greenText: '#4ADE80',
  amber: '#F5A524', amberSoft: 'rgba(245,165,36,0.18)', amberText: '#FCC468',
  blue: '#008FD6',
  blueSoft: 'rgba(0,143,214,0.22)', // oklch(62% 0.15 240 / .22)
  blueText: '#80C7F8', // oklch(80% 0.1 240)
  red: '#EF4444', redSoft: 'rgba(239,68,68,0.20)', redText: '#FF9A9A',
  neutral: '#8E8E98', neutralSoft: 'rgba(142,142,152,0.20)', neutralText: '#C9C9D0',
  danger: '#DC2626', dangerHover: '#B91C1C',
  scrim: 'rgba(0,0,0,0.72)', // the feature colour at 72%
  shadow1: '0px 1px 2px rgba(0,0,0,0.40), 0px 8px 24px -8px rgba(0,0,0,0.60)',
  shadow2: '0px 2px 6px rgba(0,0,0,0.50), 0px 20px 44px -12px rgba(0,0,0,0.75)',
  thumbShadow: '0px 1px 3px rgba(0,0,0,0.5), 0px 4px 10px -2px rgba(0,0,0,0.5)',
  paper: '#FBF8F1', paperInk: '#3F2A1A',
};

const FEATURE_STATUS: FeatureStatus = {
  greenSoft: DARK.greenSoft, greenText: DARK.greenText,
  amberSoft: DARK.amberSoft, amberText: DARK.amberText,
  blueSoft: DARK.blueSoft, blueText: DARK.blueText,
  redSoft: DARK.redSoft, redText: DARK.redText,
  neutralSoft: DARK.neutralSoft, neutralText: DARK.neutralText,
};

/** Today's token names, pointed at the new palette. Removed in phase 1d. */
function legacy(p: Palette) {
  return {
    page: p.ground, surfaceAlt: p.surfaceSunk, raised: p.track,
    muted: p.text2, mutedLight: p.text3, textInverse: p.onInk,
    border: p.hairlineStrong, borderHard: p.track,
    pendingBg: p.amberSoft, pendingFg: p.amberText, pendingDot: p.amber,
    confirmBg: p.greenSoft, confirmFg: p.greenText, confirmDot: p.go,
    progressBg: p.blueSoft, progressFg: p.blueText, progressDot: p.blue,
    doneBg: p.neutralSoft, doneFg: p.neutralText, doneDot: p.neutral,
    voidedBg: p.neutralSoft, voidedFg: p.neutralText, voidedDot: p.neutral,
    accent: p.go, accentSoft: p.greenSoft, accentFg: p.goText,
    amberFg: p.amberText, redFg: p.redText, greenFg: p.greenText,
    heroBg: p.feature, heroFg: p.onFeature, heroMuted: p.onFeature2, heroLine: p.featureTrack,
    pageFadeFrom: p.ground.length === 7 ? `${p.ground}00` : p.ground, pageFadeTo: p.ground,
    primary: p.ink, primaryFg: p.onInk, primaryHover: p.ink2, primaryRing: p.hairlineStrong,
  };
}

export type Tokens = Palette & ReturnType<typeof legacy> & {
  theme: ThemeMode;
  onFeatureStatus: FeatureStatus;
};

export function makeTokens(theme: ThemeMode = 'light'): Tokens {
  const p = theme === 'dark' ? DARK : LIGHT;
  return { ...p, ...legacy(p), theme, onFeatureStatus: FEATURE_STATUS };
}

/** Space, 4px steps. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 9: 36, 10: 40, 12: 48, 16: 64 } as const;

/** Corner radii. */
export const radius = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32, pill: 999 } as const;

// Tracking in the CSS is in em; React Native wants pixels, so it is worked out per size.
const track = (size: number, em: number) => Math.round(size * em * 100) / 100;

/**
 * Named text styles. Inter arrives in phase 1c; until then these use the
 * phone's font at the same sizes and weights.
 */
export const type = {
  display: { fontSize: 40, fontWeight: '700', lineHeight: 42, letterSpacing: track(40, -0.035) },
  figure: { fontSize: 28, fontWeight: '700', lineHeight: 31, letterSpacing: track(28, -0.02) },
  heading: { fontSize: 20, fontWeight: '700', lineHeight: 26, letterSpacing: track(20, -0.02) },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 21, letterSpacing: track(16, -0.02) },
  body: { fontSize: 14, fontWeight: '500', lineHeight: 20, letterSpacing: track(14, -0.01) },
  label: { fontSize: 13, fontWeight: '500', lineHeight: 18, letterSpacing: track(13, -0.01) },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16, letterSpacing: 0 },
} as const;

export type Motion = { fade1: number; fade2: number; move1: number; move2: number; pressScale: number };

/**
 * The two motion lengths (120ms, 200ms) and the press scale. Under the phone's
 * Reduce Motion setting, anything that slides, grows or scales loses its time
 * and distance; fades and colour changes keep theirs. Pass the setting in
 * (reanimated's useReducedMotion) so this stays pure and testable.
 */
export function motionFor(reduced: boolean): Motion {
  return { fade1: 120, fade2: 200, move1: reduced ? 0 : 120, move2: reduced ? 0 : 200, pressScale: reduced ? 1 : 0.97 };
}

/** The one curve: cubic-bezier(.2, .8, .2, 1). */
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
