// Minimal semver comparator for the force-update version gate.
//
// Deliberately NOT a string compare — "0.10.0" must sort ABOVE "0.4.0", which
// a naive string/localeCompare would get wrong (comparing '1' vs '4' char by
// char). We split into numeric segments and compare each numerically instead.
//
// NULL sorts lowest: an unreported/unknown version (e.g. config not yet
// configured, or a legacy client that never reported its version) is always
// treated as "behind" whatever it's compared against — except null == null,
// which is treated as equal (neither is behind the other).

/** Strip -prerelease / +build metadata suffixes, e.g. "1.2.3-beta.1" -> "1.2.3". */
function stripSuffix(v: string): string {
  return v.replace(/[-+].*$/, '');
}

function toSegments(v: string): number[] {
  return stripSuffix(v)
    .split('.')
    .map(seg => {
      const n = parseInt(seg, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

/**
 * Compares two semver-ish version strings.
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 * Missing trailing segments are treated as 0 ("0.4" == "0.4.0").
 * NULL sorts lowest (null < any real version); null == null.
 */
export function compareVersions(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;

  const segA = toSegments(a);
  const segB = toSegments(b);
  const len = Math.max(segA.length, segB.length);

  for (let i = 0; i < len; i++) {
    const nA = segA[i] ?? 0;
    const nB = segB[i] ?? 0;
    if (nA < nB) return -1;
    if (nA > nB) return 1;
  }
  return 0;
}
