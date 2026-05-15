// FleetMS Driver — theme tokens ported from the design handoff
// (project/driver/tokens.jsx). Two themes; primary accent is locked to violet.

export type ThemeMode = 'light' | 'dark';

// Locked brand primary — violet. To change brand colour, edit here.
const PRIMARY = {
  primary: '#7C3AED',
  primaryFg: '#FFFFFF',
  primaryHover: '#6D28D9',
  primaryRing: 'rgba(124,58,237,0.18)',
};

type BaseTokens = {
  // surfaces
  page: string; surface: string; surfaceAlt: string; raised: string;
  // text
  text: string; muted: string; mutedLight: string; textInverse: string;
  // lines
  border: string; borderHard: string;
  // status
  pendingBg: string; pendingFg: string; pendingDot: string;
  confirmBg: string; confirmFg: string; confirmDot: string;
  progressBg: string; progressFg: string; progressDot: string;
  doneBg: string; doneFg: string; doneDot: string;
  voidedBg: string; voidedFg: string; voidedDot: string;
  // functional
  accent: string; accentSoft: string; accentFg: string;
  amber: string; amberSoft: string; amberFg: string;
  red: string; redSoft: string; redFg: string;
  green: string; greenSoft: string; greenFg: string;
  // hero
  heroBg: string; heroFg: string; heroMuted: string; heroLine: string;
  // receipt paper
  paper: string; paperInk: string;
  // scrim
  scrim: string;
  // page fade colour (used by sticky CTA)
  pageFadeFrom: string; pageFadeTo: string;
};

const LIGHT: BaseTokens = {
  page: '#f0eee9', surface: '#FFFFFF', surfaceAlt: '#F8FAFC', raised: '#F1F5F9',
  text: '#0F172A', muted: '#475569', mutedLight: '#94A3B8', textInverse: '#FFFFFF',
  border: '#E2E8F0', borderHard: '#CBD5E1',
  pendingBg:  '#FEF3C7', pendingFg:  '#92400E', pendingDot:  '#F59E0B',
  confirmBg:  '#DBEAFE', confirmFg:  '#1E40AF', confirmDot:  '#3B82F6',
  progressBg: '#CFFAFE', progressFg: '#0E7490', progressDot: '#06B6D4',
  doneBg:     '#D1FAE5', doneFg:     '#065F46', doneDot:     '#10B981',
  voidedBg:   '#F1F5F9', voidedFg:   '#64748B', voidedDot:   '#94A3B8',
  accent: '#06B6D4', accentSoft: '#CFFAFE', accentFg: '#0E7490',
  amber:  '#F59E0B', amberSoft:  '#FEF3C7', amberFg:  '#92400E',
  red:    '#DC2626', redSoft:    '#FEE2E2', redFg:    '#B91C1C',
  green:  '#10B981', greenSoft:  '#D1FAE5', greenFg:  '#065F46',
  heroBg: '#0F172A', heroFg: '#FFFFFF', heroMuted: 'rgba(255,255,255,0.65)', heroLine: 'rgba(255,255,255,0.12)',
  paper: '#FBF8F1', paperInk: '#3F2A1A',
  scrim: 'rgba(15,23,42,0.45)',
  pageFadeFrom: 'rgba(240,238,233,0)', pageFadeTo: '#f0eee9',
};

const DARK: BaseTokens = {
  page: '#0B1117', surface: '#161D26', surfaceAlt: '#1F2935', raised: '#1B2330',
  text: '#F1F5F9', muted: '#94A3B8', mutedLight: '#64748B', textInverse: '#0F172A',
  border: '#222B36', borderHard: '#2F3A48',
  pendingBg:  'rgba(245,158,11,0.16)', pendingFg:  '#FCD34D', pendingDot:  '#F59E0B',
  confirmBg:  'rgba(59,130,246,0.16)', confirmFg:  '#93C5FD', confirmDot:  '#3B82F6',
  progressBg: 'rgba(34,211,238,0.16)', progressFg: '#67E8F9', progressDot: '#22D3EE',
  doneBg:     'rgba(52,211,153,0.16)', doneFg:     '#6EE7B7', doneDot:     '#34D399',
  voidedBg:   'rgba(148,163,184,0.14)', voidedFg:  '#94A3B8', voidedDot:   '#64748B',
  accent: '#22D3EE', accentSoft: 'rgba(34,211,238,0.16)', accentFg: '#67E8F9',
  amber:  '#F59E0B', amberSoft:  'rgba(245,158,11,0.16)', amberFg:  '#FCD34D',
  red:    '#F87171', redSoft:    'rgba(248,113,113,0.16)', redFg:    '#FCA5A5',
  green:  '#34D399', greenSoft:  'rgba(52,211,153,0.16)', greenFg:  '#6EE7B7',
  heroBg: '#F8FAFC', heroFg: '#0F172A', heroMuted: '#475569', heroLine: 'rgba(15,23,42,0.10)',
  paper: '#FBF8F1', paperInk: '#3F2A1A',
  scrim: 'rgba(0,0,0,0.55)',
  pageFadeFrom: 'rgba(11,17,23,0)', pageFadeTo: '#0B1117',
};

export type Tokens = BaseTokens & typeof PRIMARY & {
  theme: ThemeMode;
};

export function makeTokens(theme: ThemeMode = 'light'): Tokens {
  const base = theme === 'dark' ? DARK : LIGHT;
  return { ...base, ...PRIMARY, theme };
}
