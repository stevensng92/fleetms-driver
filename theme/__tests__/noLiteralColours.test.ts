import fs from 'fs';
import path from 'path';

// Phase 1d: screens and shared pieces take every colour from theme/tokens.ts,
// so a redesign tweak is one edit there. This fails on a raw colour typed into
// app/ or components/. Colour maths (hex to rgba) lives in theme/ instead.

const ROOT = path.resolve(__dirname, '..', '..');
const DIRS = ['app', 'components'];
const LITERAL = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const files = DIRS.flatMap(d => sourceFiles(path.join(ROOT, d)));

it('finds the source files', () => {
  expect(files.length).toBeGreaterThan(20);
});

it.each(files.map(f => [path.relative(ROOT, f).replace(/\\/g, '/'), f]))('%s has no literal colours', (_name, file) => {
  const hits = fs.readFileSync(file, 'utf8').split('\n')
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => !line.startsWith('//') && !line.startsWith('*') && LITERAL.test(line));
  expect(hits).toEqual([]);
});
