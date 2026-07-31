import { compareVersions } from '../semver';

// This comparator gates the force-update screen. If it says a driver is behind
// when they aren't, the app locks them out of their jobs — so the ordering
// rules are worth pinning even though the function is small.

describe('compareVersions', () => {
  it('sorts numerically, not lexically', () => {
    // The whole reason this exists: a string compare puts "0.10.0" BELOW
    // "0.4.0" because '1' < '4', which would fail to force-update anyone.
    expect(compareVersions('0.10.0', '0.4.0')).toBe(1);
    expect(compareVersions('0.4.0', '0.10.0')).toBe(-1);
  });

  it('reports equality for identical versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('treats missing trailing segments as zero', () => {
    expect(compareVersions('0.4', '0.4.0')).toBe(0);
    expect(compareVersions('1', '1.0.0')).toBe(0);
  });

  it('strips prerelease and build metadata', () => {
    expect(compareVersions('1.2.3-beta.1', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3+build99', '1.2.3')).toBe(0);
  });

  it('sorts null lowest, so an unreported version counts as behind', () => {
    expect(compareVersions(null, '0.1.0')).toBe(-1);
    expect(compareVersions('0.1.0', null)).toBe(1);
  });

  it('treats null == null as equal, not as behind', () => {
    // Neither side is behind the other; returning -1 here would lock out a
    // client whose version is unknown against a config that is also unset.
    expect(compareVersions(null, null)).toBe(0);
  });

  it('compares each segment in order', () => {
    expect(compareVersions('1.0.0', '0.99.99')).toBe(1);
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
  });
});
