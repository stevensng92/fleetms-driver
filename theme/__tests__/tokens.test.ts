import { FONT, fontFor, makeTokens, motionFor, radius, space, type, withAlpha } from '../tokens';

// Pins the redesign palette (design-systems/fleetms/colors_and_type.css) so a
// stray edit to theme/tokens.ts fails here instead of silently repainting the
// app. The blues are oklch in the CSS; React Native can't read oklch, so they
// are converted to hex once and pinned here.

const light = makeTokens('light');
const dark = makeTokens('dark');

describe('palette', () => {
  it('pins the light surfaces, ink and text', () => {
    expect(light).toMatchObject({
      ground: '#F6F6F7', well: '#EDEDEF', surface: '#FFFFFF', surfaceSunk: '#F2F2F4', track: '#E3E3E6',
      ink: '#131316', onInk: '#FFFFFF',
      text: '#131316', text2: '#55555E', text3: '#6B6B74',
    });
  });

  it('pins the dark surfaces, ink and text', () => {
    expect(dark).toMatchObject({
      ground: '#0B0B0D', well: '#151518', surface: '#202024', surfaceSunk: '#17171A', track: '#2A2A2F',
      ink: '#F4F4F5', onInk: '#131316',
      text: '#F4F4F5', text2: '#A4A4AD', text3: '#8E8E98',
    });
  });

  it('keeps the feature card dark in both themes', () => {
    expect(light.feature).toBe('#131316');
    expect(dark.feature).toBe('#000000');
    expect(light.onFeature).toBe('#FFFFFF');
    expect(dark.onFeature).toBe('#FFFFFF');
  });

  it('converts the oklch blues to hex', () => {
    expect(light).toMatchObject({ blue: '#008FD6', blueSoft: '#DDF0FE', blueText: '#005EA2' });
    expect(dark).toMatchObject({ blue: '#008FD6', blueSoft: 'rgba(0,143,214,0.22)', blueText: '#80C7F8' });
  });

  it('pins the green accent and its gradient ends', () => {
    expect(light).toMatchObject({ go: '#22C55E', goText: '#0E7A35', onGo: '#0C2A16', goFrom: '#2BD45F', goTo: '#B5F23D' });
    expect(dark.goText).toBe('#4ADE80');
  });

  it('gives pills on the dark card the dark tints in both themes (change 34)', () => {
    expect(light.onFeatureStatus).toEqual(dark.onFeatureStatus);
    expect(light.onFeatureStatus.blueText).toBe('#80C7F8');
    expect(light.onFeatureStatus.blueSoft).toBe('rgba(0,143,214,0.22)');
  });

  it('writes the shadows as real boxShadow strings', () => {
    expect(light.shadow1).toBe('0px 1px 2px rgba(19,19,22,0.04), 0px 6px 20px -8px rgba(19,19,22,0.10)');
    expect(dark.shadow2).toBe('0px 2px 6px rgba(0,0,0,0.50), 0px 20px 44px -12px rgba(0,0,0,0.75)');
  });
});

describe('old token names', () => {
  // Phase 1d removed the aliases that pointed old names at the new palette.
  it.each(['primary', 'primaryFg', 'page', 'muted', 'mutedLight', 'accent', 'accentFg', 'heroBg', 'heroFg',
    'pendingBg', 'confirmBg', 'progressBg', 'redFg', 'amberFg', 'border', 'raised', 'surfaceAlt', 'pageFadeTo'])(
    '%s is gone in both themes', name => {
      for (const t of [light, dark]) expect(t).not.toHaveProperty(name);
    });

  it('no longer has any violet or cyan', () => {
    for (const t of [light, dark]) {
      const values = Object.values(t).filter((v): v is string => typeof v === 'string').map(v => v.toUpperCase());
      for (const old of ['#7C3AED', '#6D28D9', '#06B6D4', '#22D3EE', '#0E7490']) expect(values).not.toContain(old);
    }
  });
});

describe('withAlpha', () => {
  it('turns a hex into rgba', () => {
    expect(withAlpha('#008FD6', 0.25)).toBe('rgba(0,143,214,0.25)');
  });
});

// WCAG relative luminance, compositing an rgba over the surface beneath it.
function rgb(c: string, under = '#FFFFFF'): [number, number, number] {
  const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(c.replace(/\s/g, ''));
  if (m) {
    const base = rgb(under);
    const a = Number(m[4]);
    return [1, 2, 3].map((i, k) => Number(m[i]) * a + base[k] * (1 - a)) as [number, number, number];
  }
  const h = c.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function lum(c: [number, number, number]): number {
  const [r, g, b] = c.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg: string, bg: string, under?: string): number {
  const a = lum(rgb(fg, under));
  const b = lum(rgb(bg, under));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('contrast, 4.5 to 1 for text', () => {
  it.each(['light', 'dark'] as const)('body text on surface and ground (%s)', mode => {
    const t = makeTokens(mode);
    for (const fg of [t.text, t.text2, t.text3]) {
      expect(contrast(fg, t.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(fg, t.ground)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(t.onInk, t.ink)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['light', 'dark'] as const)('status words on their tints (%s)', mode => {
    const t = makeTokens(mode);
    for (const [fg, bg] of [
      [t.amberText, t.amberSoft], [t.greenText, t.greenSoft], [t.blueText, t.blueSoft],
      [t.redText, t.redSoft], [t.neutralText, t.neutralSoft],
    ]) expect(contrast(fg, bg, t.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('status words on the dark card', () => {
    const t = makeTokens('light');
    const f = t.onFeatureStatus;
    for (const [fg, bg] of [[f.blueText, f.blueSoft], [f.greenText, f.greenSoft], [f.amberText, f.amberSoft], [f.neutralText, f.neutralSoft]]) {
      expect(contrast(fg, bg, t.feature)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(t.onFeature2, t.feature)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('shared scales', () => {
  it('spaces in 4px steps and the mock radii', () => {
    expect(space).toEqual({ 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 9: 36, 10: 40, 12: 48, 16: 64 });
    expect(radius).toEqual({ xs: 8, sm: 12, md: 16, lg: 24, xl: 32, pill: 999 });
  });

  it('turns em tracking into pixels per size', () => {
    expect(type.body).toMatchObject({ fontSize: 14, fontWeight: '500', letterSpacing: -0.14 });
    expect(type.title).toMatchObject({ fontSize: 16, fontWeight: '600', letterSpacing: -0.32 });
    expect(type.figure).toMatchObject({ fontSize: 28, fontWeight: '700', letterSpacing: -0.56 });
    expect(type.caption).toMatchObject({ fontSize: 12, letterSpacing: 0 });
  });
});

describe('motionFor', () => {
  it('uses the two lengths and the press scale', () => {
    expect(motionFor(false)).toEqual({ fade1: 120, fade2: 200, move1: 120, move2: 200, pressScale: 0.97 });
  });

  it('drops movement but keeps fades under Reduce Motion', () => {
    expect(motionFor(true)).toEqual({ fade1: 120, fade2: 200, move1: 0, move2: 0, pressScale: 1 });
  });
});

describe('Inter', () => {
  // Android ignores fontWeight once a custom family is set, so each weight is
  // its own family. Every named style must carry the family for its weight.
  it('maps each weight to its Inter family', () => {
    expect(fontFor('500')).toBe('Inter_500Medium');
    expect(fontFor('600')).toBe('Inter_600SemiBold');
    expect(fontFor('700')).toBe('Inter_700Bold');
    expect(FONT).toEqual({ medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' });
  });

  it('gives every named style the family for its weight', () => {
    for (const style of Object.values(type)) expect(style.fontFamily).toBe(fontFor(style.fontWeight));
  });
});
