import { pickVersionData } from './release-versions.utils';

describe('pickVersionData', () => {
  const entry = (newVersion: string | null) => ({
    currentVersion: '1.0.0',
    newVersion,
    dependentProjects: []
  });
  const versionData = { a: entry('1.1.0'), b: entry('1.0.1'), c: entry(null) };

  it('keeps only the named projects, as Nx produced them', () => {
    expect(pickVersionData(versionData, ['a', 'c'])).toEqual({
      a: versionData.a,
      c: versionData.c
    });
  });

  it('returns nothing for no projects', () => {
    expect(pickVersionData(versionData, [])).toEqual({});
  });
});
